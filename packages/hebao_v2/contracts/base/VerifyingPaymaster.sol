// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable reason-string */

import "../core/BasePaymaster.sol";
import "../thirdparty/SafeERC20.sol";
import "../lib/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * A sample paymaster that uses external service to decide whether to pay for the UserOp.
 * The paymaster trusts an external signer to sign the transaction.
 * The calling user must pass the UserOp to that external signer first, which performs
 * whatever off-chain verification before signing the UserOp.
 * Note that this signature is NOT a replacement for the account-specific signature:
 * - the paymaster checks a signature to agree to PAY for GAS.
 * - the account checks a signature to prove identity and account ownership.
 */
contract VerifyingPaymaster is BasePaymaster, AccessControl {
    using ECDSA for bytes32;
    using UserOperationLib for UserOperation;
    using SafeERC20 for ERC20;

    //calculated cost of the postOp
    uint256 private COST_OF_POST = 20000;
    uint8 constant priceDecimal = 8;
    bytes32 public constant SIGNER = keccak256("SIGNER");

    mapping(ERC20 => bool) public registeredToken;
    mapping(ERC20 => mapping(address => uint256)) public balances;
    mapping(address => uint256) public unlockBlock;

    constructor(
        IEntryPoint _entryPoint,
        address _owner
    ) BasePaymaster(_entryPoint) {
        _transferOwnership(_owner);
        _grantRole(DEFAULT_ADMIN_ROLE, owner());
        _grantRole(SIGNER, owner());
    }

    receive() external payable {
        revert("eth rejected");
    }

    function getHash(
        UserOperation calldata userOp,
        bytes memory packedData
    ) public view returns (bytes32) {
        //can't use userOp.hash(), since it contains also the paymasterAndData itself.
        return
            keccak256(
                abi.encode(
                    userOp.getSender(),
                    userOp.nonce,
                    keccak256(userOp.initCode),
                    keccak256(userOp.callData),
                    userOp.callGasLimit,
                    userOp.verificationGasLimit,
                    userOp.preVerificationGas,
                    userOp.maxFeePerGas,
                    userOp.maxPriorityFeePerGas,
                    // data of paymaster
                    block.chainid,
                    address(this),
                    packedData
                )
            );
    }

    struct DecodeData {
        address token;
        uint256 valueOfEth;
        uint256 validUntil;
        bytes signature;
    }

    /**
     * verify our external signer signed this request.
     * the "paymasterAndData" is expected to be the paymaster and a signature over the entire request params
     */
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 /*userOpHash*/,
        uint256 requiredPreFund
    )
        external
        view
        override
        returns (bytes memory context, uint256 sigTimeRange)
    {
        bytes calldata paymasterAndData = userOp.paymasterAndData;
        address sender = userOp.getSender();

        DecodeData memory decoded_data;
        // paymasterAndData: [paymaster, token, valueOfEth, validUntil, signature]
        (
            decoded_data.token,
            decoded_data.valueOfEth,
            decoded_data.validUntil,
            decoded_data.signature
        ) = abi.decode(
            paymasterAndData[20:],
            (address, uint256, uint256, bytes)
        );
        require(
            unlockBlock[sender] == 0,
            "DepositPaymaster: deposit not locked"
        );
        //ECDSA library supports both 64 and 65-byte long signatures.
        // we only "require" it here so that the revert reason on invalid signature will be of "VerifyingPaymaster", and not "ECDSA"
        require(
            decoded_data.signature.length == 64 ||
                decoded_data.signature.length == 65,
            "VerifyingPaymaster: invalid signature length in paymasterAndData"
        );
        uint256 costOfPost = userOp.gasPrice() * COST_OF_POST;

        if (decoded_data.valueOfEth > 0) {
            uint256 tokenRequiredPreFund = ((requiredPreFund + costOfPost) *
                10 ** priceDecimal) / decoded_data.valueOfEth;
            require(
                balances[ERC20(decoded_data.token)][sender] >=
                    tokenRequiredPreFund ||
                    ERC20(decoded_data.token).allowance(
                        sender,
                        address(this)
                    ) >=
                    tokenRequiredPreFund,
                "Paymaster: not enough allowance"
            );
        }

        bytes32 hash = getHash(
            userOp,
            abi.encodePacked(
                decoded_data.token,
                decoded_data.valueOfEth,
                decoded_data.validUntil
            )
        );

        //don't revert on signature failure: return SIG_VALIDATION_FAILED
        if (
            !hasRole(
                SIGNER,
                hash.toEthSignedMessageHash().recover(decoded_data.signature)
            )
        ) {
            return ("", 1);
        }

        //no need for other on-chain validation: entire UserOp should have been checked
        // by the external service prior to signing it.
        return (
            abi.encode(
                sender,
                decoded_data.token,
                costOfPost,
                decoded_data.valueOfEth
            ),
            packSigTimeRange(false, decoded_data.validUntil, 0)
        );
    }

    /**
     * post-operation handler.
     * (verified to be called only through the entryPoint)
     * @dev if subclass returns a non-empty context from validatePaymasterUserOp, it must also implement this method.
     * @param mode enum with the following options:
     *      opSucceeded - user operation succeeded.
     *      opReverted  - user op reverted. still has to pay for gas.
     *      postOpReverted - user op succeeded, but caused postOp (in mode=opSucceeded) to revert.
     *                       Now this is the 2nd call, after user's op was deliberately reverted.
     * @param context - the context value returned by validatePaymasterUserOp
     * @param actualGasCost - actual gas used so far (without this postOp call).
     */
    function _postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) internal override {
        (mode);
        (
            address account,
            address payable token,
            uint256 costOfPost,
            uint256 valueOfEth
        ) = abi.decode(context, (address, address, uint256, uint256));
        if (valueOfEth > 0) {
            uint256 actualTokenCost = ((actualGasCost + costOfPost) *
                10 ** priceDecimal) / valueOfEth;

            if (balances[ERC20(token)][account] >= actualTokenCost) {
                balances[ERC20(token)][account] -= actualTokenCost;
            } else {
                // attempt to pay with tokens:
                ERC20(token).safeTransferFrom(
                    account,
                    address(this),
                    actualTokenCost
                );
            }
            balances[ERC20(token)][owner()] += actualTokenCost;
        }
    }

    ////////////////////////////////////
    // gas tank

    /**
     * owner of the paymaster should add supported tokens
     */
    function addToken(ERC20 token) external onlyOwner {
        require(!registeredToken[token]);
        registeredToken[token] = true;
    }

    /**
     * deposit tokens that a specific account can use to pay for gas.
     * The sender must first approve this paymaster to withdraw these tokens (they are only withdrawn in this method).
     * Note depositing the tokens is equivalent to transferring them to the "account" - only the account can later
     *  use them - either as gas, or using withdrawTo()
     *
     * @param token the token to deposit.
     * @param account the account to deposit for.
     * @param amount the amount of token to deposit.
     */
    function addDepositFor(
        ERC20 token,
        address account,
        uint256 amount
    ) external {
        //(sender must have approval for the paymaster)
        token.safeTransferFrom(msg.sender, address(this), amount);
        require(registeredToken[token], "unsupported token");
        balances[token][account] += amount;
        if (msg.sender == account) {
            lockTokenDeposit();
        }
    }

    function depositInfo(
        ERC20 token,
        address account
    ) public view returns (uint256 amount, uint256 _unlockBlock) {
        amount = balances[token][account];
        _unlockBlock = unlockBlock[account];
    }

    /**
     * unlock deposit, so that it can be withdrawn.
     * can't be called in the same block as withdrawTo()
     */
    function unlockTokenDeposit() public {
        unlockBlock[msg.sender] = block.number;
    }

    /**
     * lock the tokens deposited for this account so they can be used to pay for gas.
     * after calling unlockTokenDeposit(), the account can't use this paymaster until the deposit is locked.
     */
    function lockTokenDeposit() public {
        unlockBlock[msg.sender] = 0;
    }

    /**
     * withdraw tokens.
     * can only be called after unlock() is called in a previous block.
     * @param token the token deposit to withdraw
     * @param target address to send to
     * @param amount amount to withdraw
     */
    function withdrawTokensTo(
        ERC20 token,
        address target,
        uint256 amount
    ) public {
        require(
            unlockBlock[msg.sender] != 0 &&
                block.number > unlockBlock[msg.sender],
            "DepositPaymaster: must unlockTokenDeposit"
        );
        balances[token][msg.sender] -= amount;
        token.safeTransfer(target, amount);
    }
}
