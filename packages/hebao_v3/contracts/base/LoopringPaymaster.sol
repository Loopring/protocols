// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable reason-string */
/* solhint-disable no-inline-assembly */

import "../account-abstraction/core/BasePaymaster.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * A sample paymaster that uses external service to decide whether to pay for the UserOp.
 * The paymaster trusts an external signer to sign the transaction.
 * The calling user must pass the UserOp to that external signer first, which performs
 * whatever off-chain verification before signing the UserOp.
 * Note that this signature is NOT a replacement for the account-specific signature:
 * - the paymaster checks a signature to agree to PAY for GAS.
 * - the account checks a signature to prove identity and account ownership.
 */
contract LoopringPaymaster is BasePaymaster, AccessControl {
    using ECDSA for bytes32;
    using UserOperationLib for UserOperation;
    using SafeERC20 for IERC20;

    uint256 private constant VALID_TIMESTAMP_OFFSET = 20;

    uint256 private constant SIGNATURE_OFFSET = 84;

    // calculated cost of the postOp
    uint256 private constant COST_OF_POST = 60000;
    uint8 private constant PRICE_DECIMAL = 8;
    bytes32 public constant SIGNER = keccak256("SIGNER");

    mapping(address => bool) public registeredToken;
    mapping(address => mapping(address => uint256)) public balances;
    mapping(address => uint256) public unlockBlock;

    event PaymasterEvent(
        bytes32 indexed userOpHash,
        address token,
        uint256 valueOfEth,
        uint256 actualETHCost,
        uint256 actualTokenCost
    );

    error TokenLocked(address token, address user, uint256 unlockedBlockNumber);
    error TokenUnregistered(address token);
    error TokenRegistered(address token);
    error InvalidSignatureLength(uint256 length);
    error NoEnoughTokenBalance(address user, uint256 tokenRequiredPreFund);

    constructor(
        IEntryPoint _entryPoint,
        address paymasterOwner
    ) BasePaymaster(_entryPoint) {
        _transferOwnership(paymasterOwner);
        _grantRole(DEFAULT_ADMIN_ROLE, owner());
        _grantRole(SIGNER, paymasterOwner);
    }

    receive() external payable {
        revert("eth rejected");
    }

    struct DecodedData {
        address token;
        uint48 validUntil;
        // uint48 validAfter;
        uint256 valueOfEth;
    }

    /**
     * return the hash we're going to sign off-chain (and validate on-chain)
     * this method is called by the off-chain service, to sign the request.
     * it is called on-chain from the validatePaymasterUserOp, to validate the signature.
     * note that this signature covers all fields of the UserOperation, except the "paymasterAndData",
     * which will carry the signature itself.
     */
    function getHash(
        UserOperation calldata userOp,
        bytes32 dataHash
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
                    dataHash
                )
            );
    }

    /**
     * verify our external signer signed this request.
     * the "paymasterAndData" is expected to be the paymaster and a signature over the entire request params
     * paymasterAndData[:20] : address(this)
     * paymasterAndData[20:84] : abi.encode(validUntil, validAfter)
     * paymasterAndData[84:] : signature
     */
    function _validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 requiredPreFund
    ) internal view override returns (bytes memory, uint256) {
        address sender = userOp.getSender();
        (
            DecodedData memory decodedData,
            bytes memory signature
        ) = parsePaymasterAndData(userOp.paymasterAndData);
        if (!registeredToken[decodedData.token]) {
            revert TokenUnregistered(decodedData.token);
        }

        //ECDSA library supports both 64 and 65-byte long signatures.
        // we only "require" it here so that the revert reason on invalid signature will be of "VerifyingPaymaster", and not "ECDSA"
        if (signature.length != 64 && signature.length != 65) {
            revert InvalidSignatureLength(signature.length);
        }

        // NOTE(cannot use basefee during validation)
        uint256 costOfPost = userOp.maxFeePerGas * COST_OF_POST;
        // skip allowance check to allow user to start without any eth to pay for approve
        if (decodedData.valueOfEth > 0) {
            uint256 tokenRequiredPreFund = ((requiredPreFund + costOfPost) *
                10 ** PRICE_DECIMAL) / decodedData.valueOfEth;
            if (
                !(unlockBlock[sender] == 0 &&
                    balances[decodedData.token][sender] >=
                    tokenRequiredPreFund) &&
                IERC20(decodedData.token).balanceOf(sender) <
                tokenRequiredPreFund
            ) {
                revert NoEnoughTokenBalance(sender, tokenRequiredPreFund);
            }
        }
        bytes32 hash = ECDSA.toEthSignedMessageHash(
            getHash(
                userOp,
                keccak256(
                    abi.encodePacked(
                        decodedData.token,
                        decodedData.validUntil,
                        // decodedData.validAfter,
                        decodedData.valueOfEth
                    )
                )
            )
        );

        //don't revert on signature failure: return SIG_VALIDATION_FAILED
        if (!hasRole(SIGNER, hash.recover(signature))) {
            return (
                "",
                _packValidationData(
                    true,
                    decodedData.validUntil,
                    uint48(0) /*decodedData.validAfter*/
                )
            );
        }

        //no need for other on-chain validation: entire UserOp should have been checked
        // by the external service prior to signing it.
        return (
            abi.encode(
                userOpHash,
                sender,
                decodedData.token,
                costOfPost,
                decodedData.valueOfEth
            ),
            _packValidationData(
                false,
                decodedData.validUntil,
                uint48(0) /*decodedData.validAfter*/
            )
        );
    }

    function parsePaymasterAndData(
        bytes calldata paymasterAndData
    )
        public
        pure
        returns (DecodedData memory decodedData, bytes memory signature)
    {
        (
            decodedData.token,
            decodedData.validUntil,
            decodedData.valueOfEth,
            signature
        ) = abi.decode(
            paymasterAndData[VALID_TIMESTAMP_OFFSET:],
            (address, uint48, uint256, bytes)
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
            bytes32 userOpHash,
            address account,
            address payable token,
            uint256 costOfPost,
            uint256 valueOfEth
        ) = abi.decode(context, (bytes32, address, address, uint256, uint256));
        uint256 actualTokenCost;
        uint256 actualETHCost = actualGasCost + costOfPost;
        if (valueOfEth > 0) {
            actualTokenCost =
                (actualETHCost * 10 ** PRICE_DECIMAL) /
                valueOfEth;

            if (balances[token][account] >= actualTokenCost) {
                balances[token][account] -= actualTokenCost;
            } else {
                // attempt to pay with tokens:
                IERC20(token).safeTransferFrom(
                    account,
                    address(this),
                    actualTokenCost
                );
            }
            balances[token][owner()] += actualTokenCost;
        }

        emit PaymasterEvent(
            userOpHash,
            token,
            valueOfEth,
            actualETHCost,
            actualTokenCost
        );
    }

    ////////////////////////////////////
    // gas tank

    /**
     * owner of the paymaster should add supported tokens
     */
    function addToken(address token) external onlyOwner {
        if (registeredToken[token]) {
            revert TokenRegistered(token);
        }
        registeredToken[token] = true;
    }

    function removeToken(address token) external onlyOwner {
        if (!registeredToken[token]) {
            revert TokenUnregistered(token);
        }
        registeredToken[token] = false;
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
        address token,
        address account,
        uint256 amount
    ) external {
        if (!registeredToken[token]) {
            revert TokenUnregistered(token);
        }
        //(sender must have approval for the paymaster)
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        balances[token][account] += amount;
        if (msg.sender == account) {
            lockTokenDeposit();
        }
    }

    function depositInfo(
        address token,
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
        address token,
        address target,
        uint256 amount
    ) public {
        uint256 unlockedBlockNumber = unlockBlock[msg.sender];
        if (unlockedBlockNumber == 0 || block.number <= unlockedBlockNumber) {
            revert TokenLocked(msg.sender, token, unlockedBlockNumber);
        }
        balances[token][msg.sender] -= amount;
        IERC20(token).safeTransfer(target, amount);
    }
}
