// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable reason-string */
/* solhint-disable no-inline-assembly */

import '../account-abstraction/core/BasePaymaster.sol';
import '../thirdparty/SafeERC20.sol';
import '../lib/ERC20.sol';
import '@openzeppelin/contracts/access/AccessControl.sol';
import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';

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
    using SafeERC20 for ERC20;

    uint256 private constant VALID_TIMESTAMP_OFFSET = 20;

    uint256 private constant SIGNATURE_OFFSET = 84;

    //calculated cost of the postOp
    uint256 private COST_OF_POST = 20000;
    uint8 constant priceDecimal = 8;
    bytes32 public constant SIGNER = keccak256('SIGNER');

    mapping(ERC20 => bool) public registeredToken;
    mapping(ERC20 => mapping(address => uint256)) public balances;
    mapping(address => uint256) public unlockBlock;

    event PaymasterEvent(
        bytes32 indexed userOpHash,
        address token,
        uint256 valueOfEth,
        uint256 actualTokenCost
    );

    event EntryPointChanged(address indexed newEntrypoint);

    constructor(
        IEntryPoint _entryPoint,
        address paymasterOwner
    ) BasePaymaster(_entryPoint) {
        _transferOwnership(paymasterOwner);
        _grantRole(DEFAULT_ADMIN_ROLE, owner());
        _grantRole(SIGNER, paymasterOwner);
    }

    receive() external payable {
        revert('eth rejected');
    }

    mapping(address => uint256) public senderNonce;

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
    )
        internal
        override
        returns (bytes memory context, uint256 validationData)
    {
        address sender = userOp.getSender();
        (
            DecodedData memory decoded_data,
            bytes memory signature
        ) = parsePaymasterAndData(userOp.paymasterAndData);
        require(
            unlockBlock[sender] == 0,
            'DepositPaymaster: deposit not locked'
        );
        require(
            registeredToken[decoded_data.token],
            'unsupported tokens'
        );
        //ECDSA library supports both 64 and 65-byte long signatures.
        // we only "require" it here so that the revert reason on invalid signature will be of "VerifyingPaymaster", and not "ECDSA"
        require(
            signature.length == 64 || signature.length == 65,
            'VerifyingPaymaster: invalid signature length in paymasterAndData'
        );

        uint256 costOfPost = userOp.gasPrice() * COST_OF_POST;
        // check allowance of user
        if (decoded_data.valueOfEth > 0) {
            uint256 tokenRequiredPreFund = ((requiredPreFund +
                costOfPost) * 10 ** priceDecimal) /
                decoded_data.valueOfEth;
            require(
                balances[ERC20(decoded_data.token)][sender] >=
                    tokenRequiredPreFund ||
                    (ERC20(decoded_data.token).allowance(
                        sender,
                        address(this)
                    ) >=
                        tokenRequiredPreFund &&
                        ERC20(decoded_data.token).balanceOf(sender) >=
                        tokenRequiredPreFund),
                'Paymaster: no enough allowance or token balances'
            );
        }
        bytes32 hash = ECDSA.toEthSignedMessageHash(
            getHash(
                userOp,
                keccak256(
                    abi.encodePacked(
                        decoded_data.token,
                        decoded_data.validUntil,
                        // decoded_data.validAfter,
                        decoded_data.valueOfEth
                    )
                )
            )
        );
        senderNonce[userOp.getSender()]++;

        //don't revert on signature failure: return SIG_VALIDATION_FAILED
        if (!hasRole(SIGNER, hash.recover(signature))) {
            return (
                '',
                _packValidationData(
                    true,
                    decoded_data.validUntil,
                    uint48(0) /*decoded_data.validAfter*/
                )
            );
        }

        //no need for other on-chain validation: entire UserOp should have been checked
        // by the external service prior to signing it.
        return (
            abi.encode(
                userOpHash,
                sender,
                decoded_data.token,
                costOfPost,
                decoded_data.valueOfEth
            ),
            _packValidationData(
                false,
                decoded_data.validUntil,
                uint48(0) /*decoded_data.validAfter*/
            )
        );
    }

    function parsePaymasterAndData(
        bytes calldata paymasterAndData
    )
        public
        pure
        returns (
            DecodedData memory decodedData,
            bytes memory signature
        )
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
        ) = abi.decode(
                context,
                (bytes32, address, address, uint256, uint256)
            );
        uint256 actualTokenCost;
        if (valueOfEth > 0) {
            actualTokenCost =
                ((actualGasCost + costOfPost) * 10 ** priceDecimal) /
                valueOfEth;

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

        emit PaymasterEvent(
            userOpHash,
            token,
            valueOfEth,
            actualTokenCost
        );
    }

    ////////////////////////////////////
    // gas tank

    /**
     * owner of the paymaster should add supported tokens
     */
    function addToken(ERC20 token) external onlyOwner {
        require(!registeredToken[token], 'registered already');
        registeredToken[token] = true;
    }

    function removeToken(ERC20 token) external onlyOwner {
        require(registeredToken[token], 'unregistered already');
        registeredToken[token] = false;
    }

    function changeEntryPoint(
        IEntryPoint newEntryPoint
    ) external onlyOwner {
        require(
            address(newEntryPoint) != address(0),
            'INVALID ENTRYPOINT'
        );
        require(entryPoint != newEntryPoint, 'SAME ENTRYPOINT');
        entryPoint = newEntryPoint;

        emit EntryPointChanged(address(newEntryPoint));
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
        require(registeredToken[token], 'unsupported token');
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
            'DepositPaymaster: must unlockTokenDeposit'
        );
        balances[token][msg.sender] -= amount;
        token.safeTransfer(target, amount);
    }
}
