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
    uint8 constant priceDecimal = 6;
    bytes32 public constant SIGNER = keccak256("SIGNER");

    constructor(
        IEntryPoint _entryPoint,
        address _owner
    ) BasePaymaster(_entryPoint) {
        _transferOwnership(_owner);
        _grantRole(DEFAULT_ADMIN_ROLE, owner());
        _grantRole(SIGNER, owner());
    }

    function getHash(
        UserOperation calldata userOp,
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
                    block.chainid,
                    address(this),
                    token,
                    valueOfEth
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
        // paymasterAndData: [paymaster, token, valueOfEth, signature]
        (
            decoded_data.token,
            decoded_data.valueOfEth,
            decoded_data.validUntil,
            decoded_data.signature
        ) = abi.decode(
            paymasterAndData[20:],
            (address, uint256, uint256, bytes)
        );
        uint256 sigLength = decoded_data.signature.length;
        //ECDSA library supports both 64 and 65-byte long signatures.
        // we only "require" it here so that the revert reason on invalid signature will be of "VerifyingPaymaster", and not "ECDSA"
        require(
            sigLength == 64 || sigLength == 65,
            "VerifyingPaymaster: invalid signature length in paymasterAndData"
        );

        {
            // uint256 tokenRequiredPreFund = ((requiredPreFund + (COST_OF_POST)) *
            // 10 ** priceDecimal) / decoded_data.valueOfEth;
            // require(
            // ERC20(decoded_data.token).allowance(sender, address(this)) >=
            // tokenRequiredPreFund,
            // "Paymaster: not enough allowance"
            // );
        }

        // TODO (add validUntil)
        bytes32 hash = getHash(
            userOp,
            decoded_data.token,
            decoded_data.valueOfEth
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
                userOp.gasPrice(),
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
        (address sender, address payable token, , uint256 valueOfEth) = abi
            .decode(context, (address, address, uint256, uint256));
        if (valueOfEth > 0) {
            uint256 tokenRequiredFund = ((actualGasCost + (COST_OF_POST)) *
                10 ** priceDecimal) / valueOfEth;
            ERC20(token).safeTransferFrom(
                sender,
                address(this),
                tokenRequiredFund
            );
        }
    }

    function _withdrawToken(address token, address to, uint256 amount) private {
        ERC20(token).transfer(to, amount);
    }

    // withdraw token from this contract
    function withdrawToken(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        _withdrawToken(token, to, amount);
    }

    // withdraw token from this contract
    function withdrawTokens(
        address[] calldata token,
        address to,
        uint256[] calldata amount
    ) external onlyOwner {
        require(token.length == amount.length, "length mismatch");
        for (uint256 i = 0; i < token.length; i++) {
            _withdrawToken(token[i], to, amount[i]);
        }
    }
}
