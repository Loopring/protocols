// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable reason-string */

import "../core/BasePaymaster.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * A sample paymaster that uses external service to decide whether to pay for the UserOp.
 * The paymaster trusts an external signer to sign the transaction.
 * The calling user must pass the UserOp to that external signer first, which performs
 * whatever off-chain verification before signing the UserOp.
 * Note that this signature is NOT a replacement for the account-specific signature:
 * - the paymaster checks a signature to agree to PAY for GAS.
 * - the account checks a signature to prove identity and account ownership.
 */
contract VerifyingPaymaster is BasePaymaster {
    using ECDSA for bytes32;
    using UserOperationLib for UserOperation;

    address public immutable verifyingSigner;

    //calculated cost of the postOp
    uint256 private COST_OF_POST = 20000;

    constructor(
        IEntryPoint _entryPoint,
        address _verifyingSigner
    ) BasePaymaster(_entryPoint) {
        verifyingSigner = _verifyingSigner;
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
        address paymaster,
        address token,
        uint256 valueOfEth
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
                    paymaster,
                    block.chainid,
                    token,
                    valueOfEth
                )
            );
    }

    /**
     * verify our external signer signed this request.
     * the "paymasterAndData" is expected to be the paymaster and a signature over the entire request params
     */
    function _validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 /*userOpHash*/,
        uint256 requiredPreFund
    )
        internal
        view
        override
        returns (bytes memory context, uint256 sigTimeRange)
    {
        (requiredPreFund);

        bytes calldata paymasterAndData = userOp.paymasterAndData;
        address sender = userOp.getSender();

        // paymasterAndData: [paymaster, token, valueOfEth, signature]
        (address token, uint256 valueOfEth, bytes memory signature) = abi
            .decode(paymasterAndData[20:], (address, uint256, bytes));
        uint256 sigLength = signature.length;
        //ECDSA library supports both 64 and 65-byte long signatures.
        // we only "require" it here so that the revert reason on invalid signature will be of "VerifyingPaymaster", and not "ECDSA"
        require(
            sigLength == 64 || sigLength == 65,
            "VerifyingPaymaster: invalid signature length in paymasterAndData"
        );

        bytes32 hash = getHash(
            userOp,
            address(bytes20(paymasterAndData[:20])),
            token,
            valueOfEth
        );
        //don't revert on signature failure: return SIG_VALIDATION_FAILED
        if (
            verifyingSigner != hash.toEthSignedMessageHash().recover(signature)
        ) {
            return ("", 1);
        }

        //no need for other on-chain validation: entire UserOp should have been checked
        // by the external service prior to signing it.
        return (abi.encode(sender, token, userOp.gasPrice(), valueOfEth), 0);
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
        (address sender, address payable token, , uint256 valueOfEth) = abi
            .decode(context, (address, address, uint256, uint256));
        if (valueOfEth > 0) {
            uint256 missingDecimals = uint256(18) -
                (IERC20Metadata(token).decimals());
            uint8 priceDecimal = 6;
            uint256 tokenRequiredFund = ((actualGasCost + (COST_OF_POST)) *
                (10 ** priceDecimal)) / (valueOfEth * (10 ** missingDecimals));
            IERC20(token).transferFrom(
                sender,
                address(this),
                tokenRequiredFund
            );
        }
    }
}
