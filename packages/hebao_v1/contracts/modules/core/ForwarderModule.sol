// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/AddressUtil.sol";
import "../../lib/EIP712.sol";
import "../../lib/ERC20.sol";
import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";
import "../../thirdparty/BytesUtil.sol";
import "../base/BaseModule.sol";
import "./WalletFactory.sol";

/// @title ForwarderModule
/// @dev A module to support wallet meta-transactions.
///
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract ForwarderModule is BaseModule
{
    using AddressUtil   for address;
    using BytesUtil     for bytes;
    using MathUint      for uint;
    using SignatureUtil for bytes32;

    uint    public constant MAX_REIMBURSTMENT_OVERHEAD = 165000;
    bytes32 public FORWARDER_DOMAIN_SEPARATOR;

    event MetaTxExecuted(
        address relayer,
        address from,
        uint    nonce,
        bytes32 txAwareHash,
        bool    success,
        address gasToken,
        uint    gasPrice,
        uint    gasLimit,
        uint    gasUsed
    );

    struct MetaTx {
        address from; // the wallet
        address to;
        uint    nonce;
        bytes32 txAwareHash;
        address gasToken;
        uint    gasPrice;
        uint    gasLimit;
        bytes   data;
    }

    bytes32 constant public META_TX_TYPEHASH = keccak256(
        "MetaTx(address from,address to,uint256 nonce,bytes32 txAwareHash,address gasToken,uint256 gasPrice,uint256 gasLimit,bytes data)"
    );

    function validateMetaTx(
        address from, // the wallet
        address to,
        uint    nonce,
        bytes32 txAwareHash,
        address gasToken,
        uint    gasPrice,
        uint    gasLimit,
        bytes   memory data,
        bytes   memory signature
        )
        public
        view
    {
        // Since this contract is a module, we need to prevent wallet from interacting with
        // Stores via this module. Therefore, we must carefully check the 'to' address as follows,
        // so no Store can be used as 'to'.
        require(
            (to != address(this)) &&
            controller().moduleRegistry().isModuleRegistered(to) ||

            // We only allow the wallet to call itself to addModule
            (to == from) &&
            data.toBytes4(0) == Wallet.addModule.selector &&
            controller().walletRegistry().isWalletRegistered(from) ||

            to == controller().walletFactory(),
            "INVALID_DESTINATION_OR_METHOD"
        );
        require(
            nonce == 0 && txAwareHash != 0 ||
            nonce != 0 && txAwareHash == 0,
            "INVALID_NONCE"
        );

        bytes memory data_ = txAwareHash == 0 ? data : data.slice(0, 4); // function selector

        bytes memory encoded = abi.encode(
            META_TX_TYPEHASH,
            from,
            to,
            nonce,
            txAwareHash,
            gasToken,
            gasPrice,
            gasLimit,
            keccak256(data_)
        );

        bytes32 metaTxHash = EIP712.hashPacked(FORWARDER_DOMAIN_SEPARATOR, encoded);
        require(metaTxHash.verifySignature(from, signature), "INVALID_SIGNATURE");
    }

    function executeMetaTx(
        MetaTx calldata metaTx,
        bytes  calldata signature
        )
        external
        nonReentrant
        returns (
            bool         success,
            bytes memory ret
        )
    {
        uint gasLeft = gasleft();
        checkSufficientGas(metaTx);

        // The trick is to append the really logical message sender and the
        // transaction-aware hash to the end of the call data.
        (success, ret) = metaTx.to.fastCall(
            metaTx.gasLimit,
            0,
            abi.encodePacked(metaTx.data, metaTx.from, metaTx.txAwareHash)
        );

        // It's ok to do the validation after the 'call'. This is also necessary
        // in the case of creating the wallet, otherwise, wallet signature validation
        // will fail before the wallet is created.
        validateMetaTx(
            metaTx.from,
            metaTx.to,
            metaTx.nonce,
            metaTx.txAwareHash,
            metaTx.gasToken,
            metaTx.gasPrice,
            metaTx.gasLimit,
            metaTx.data,
            signature
        );

        // Nonce update must come after the real transaction in case of new wallet creation.
        if (metaTx.nonce != 0) {
            controller().nonceStore().verifyAndUpdate(metaTx.from, metaTx.nonce);
        }

        uint gasUsed = gasLeft - gasleft() +
            (signature.length + metaTx.data.length + 7 * 32) * 16 + // data input cost
            447 +  // cost of MetaTxExecuted = 375 + 9 * 8
            23000; // transaction cost;

        // Fees are not to be charged by a relayer if the transaction fails with a
        // non-zero txAwareHash. The reason is that relayer can pick arbitrary 'data'
        // to make the transaction fail. Charging fees for such failures can drain
        // wallet funds.
        bool needReimburse = metaTx.gasPrice > 0 && (metaTx.txAwareHash == 0 || success);

        if (needReimburse) {
            gasUsed = gasUsed +
                MAX_REIMBURSTMENT_OVERHEAD + // near-worst case cost
                2300; // 2*SLOAD+1*CALL = 2*800+1*700=2300

            // Do not consume quota when call factory's createWallet function or
            // when a successful meta-tx's txAwareHash is non-zero (which means it will
            // be signed by at least a guardian). Therefor, even if the owner's
            // private key is leaked, the hacker won't be able to deplete ether/tokens
            // as high meta-tx fees.
            bool skipQuota = success && (
                metaTx.txAwareHash != 0 || (
                    metaTx.data.toBytes4(0) == WalletFactory.createWallet.selector ||
                    metaTx.data.toBytes4(0) == WalletFactory.createWallet2.selector) &&
                metaTx.to == controller().walletFactory()
            );

            // MAX_REIMBURSTMENT_OVERHEAD covers an ERC20 transfer and a quota update.
            if (skipQuota) {
                gasUsed -= 48000;
            }

            if (metaTx.gasToken == address(0)) {
                gasUsed -= 15000; // diff between an regular ERC20 transfer and an ETH send
            }

            uint gasToReimburse = gasUsed <= metaTx.gasLimit ? gasUsed : metaTx.gasLimit;

            reimburseGasFee(
                metaTx.from,
                controller().collectTo(),
                metaTx.gasToken,
                metaTx.gasPrice,
                gasToReimburse,
                skipQuota
            );
        }

        emit MetaTxExecuted(
            msg.sender,
            metaTx.from,
            metaTx.nonce,
            metaTx.txAwareHash,
            success,
            metaTx.gasToken,
            metaTx.gasPrice,
            metaTx.gasLimit,
            gasUsed
        );
    }

    function checkSufficientGas(
        MetaTx calldata metaTx
        )
        private
        view
    {
        // Check the relayer has enough Ether gas
        uint gasLimit = metaTx.gasLimit.mul(64) / 63;

        require(gasleft() >= gasLimit, "OPERATOR_INSUFFICIENT_GAS");

        // Check the wallet has enough meta tx gas
        if (metaTx.gasPrice > 0) {
            uint gasCost = gasLimit.mul(metaTx.gasPrice);

            if (metaTx.gasToken == address(0)) {
                require(
                    metaTx.from.balance >= gasCost,
                    "WALLET_INSUFFICIENT_ETH_GAS"
                );
            } else {
                require(
                    ERC20(metaTx.gasToken).balanceOf(metaTx.from) >= gasCost,
                    "WALLET_INSUFFICIENT_TOKEN_GAS"
                );
            }
        }
    }
}
