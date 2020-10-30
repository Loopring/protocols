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
import "../security/SecurityModule.sol";
import "./WalletFactory.sol";

/// @title ForwarderModule
/// @dev A module to support wallet meta-transactions.
///
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract ForwarderModule is SecurityModule
{
    using AddressUtil   for address;
    using BytesUtil     for bytes;
    using MathUint      for uint;
    using SignatureUtil for bytes32;

    uint    public constant  MAX_REIMBURSTMENT_OVERHEAD = 165000;
    bytes32 public immutable FORWARDER_DOMAIN_SEPARATOR;

    bytes32 public constant META_TX_TYPEHASH = keccak256(
        "MetaTx(address from,address to,uint256 nonce,bytes32 txAwareHash,address gasToken,uint256 gasPrice,uint256 gasLimit,bytes data)"
    );

    mapping(address => uint) public nonces;

    event MetaTxExecuted(
        address relayer,
        address from,
        uint    nonce,
        bytes32 txAwareHash,
        bool    success,
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
    }

    constructor(ControllerImpl _controller)
        SecurityModule(_controller, address(this))
    {
        FORWARDER_DOMAIN_SEPARATOR = EIP712.hash(
            EIP712.Domain("ForwarderModule", "1.2.0", address(this))
        );
    }

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
        verifyTo(to, from, data);
        require(
            msg.sender != address(this) ||
            data.toBytes4(0) == ForwarderModule.batchCall.selector,
            "INVALID_TARGET"
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

        // Instead of always taking the expensive path through ER1271,
        // skip directly to the wallet owner here (which could still be another contract).
        //require(metaTxHash.verifySignature(from, signature), "INVALID_SIGNATURE");
        require(!securityStore.isLocked(from), "WALLET_LOCKED");
        require(metaTxHash.verifySignature(Wallet(from).owner(), signature), "INVALID_SIGNATURE");
    }

    function executeMetaTx(
        address from, // the wallet
        address to,
        uint    nonce,
        bytes32 txAwareHash,
        address gasToken,
        uint    gasPrice,
        uint    gasLimit,
        bytes   calldata data,
        bytes   calldata signature
        )
        external
        returns (
            bool success
        )
    {
        MetaTx memory metaTx = MetaTx(
            from,
            to,
            nonce,
            txAwareHash,
            gasToken,
            gasPrice,
            gasLimit
        );

        uint gasLeft = gasleft();
        require(gasLeft >= (gasLimit.mul(64) / 63), "OPERATOR_INSUFFICIENT_GAS");

        // Update the nonce before the call to protect against reentrancy
        if (metaTx.nonce != 0) {
            verifyAndUpdateNonce(metaTx.from, metaTx.nonce);
        }

        // The trick is to append the really logical message sender and the
        // transaction-aware hash to the end of the call data.
        (success, ) = metaTx.to.call{gas : metaTx.gasLimit, value : 0}(
            abi.encodePacked(data, metaTx.from, metaTx.txAwareHash)
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
            data,
            signature
        );

        uint gasUsed = gasLeft - gasleft() +
            (signature.length + data.length + 7 * 32) * 16 + // data input cost
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
                    data.toBytes4(0) == WalletFactory.createWallet.selector ||
                    data.toBytes4(0) == WalletFactory.createWallet2.selector) &&
                metaTx.to == walletFactory
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
                controllerCache.collectTo,
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
            gasUsed
        );
    }

    function batchCall(
        address   wallet,
        address[] calldata to,
        bytes[]   calldata data
        )
        external
        txAwareHashNotAllowed()
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
    {
        require(to.length == data.length, "INVALID_DATA");

        for (uint i = 0; i < to.length; i++) {
            require(to[i] != address(this), "INVALID_TARGET");
            verifyTo(to[i], wallet, data[i]);
            // The trick is to append the really logical message sender and the
            // transaction-aware hash to the end of the call data.
            (bool success, ) = to[i].call(
                abi.encodePacked(data[i], wallet, bytes32(0))
            );
            require(success, "BATCHED_CALL_FAILED");
        }
    }

    function lastNonce(address wallet)
        public
        view
        returns (uint)
    {
        return nonces[wallet];
    }

    function isNonceValid(address wallet, uint nonce)
        public
        view
        returns (bool)
    {
        return nonce > nonces[wallet] && (nonce >> 128) <= block.number;
    }

    function verifyTo(
        address to,
        address wallet,
        bytes   memory data
        )
        internal
        view
    {
        // Since this contract is a module, we need to prevent wallet from interacting with
        // Stores via this module. Therefore, we must carefully check the 'to' address as follows,
        // so no Store can be used as 'to'.
        require(
            moduleRegistry.isModuleRegistered(to) ||

            // We only allow the wallet to call itself to addModule
            (to == wallet) &&
            data.toBytes4(0) == Wallet.addModule.selector ||

            to == walletFactory,
            "INVALID_DESTINATION_OR_METHOD"
        );
    }

    function verifyAndUpdateNonce(address wallet, uint nonce)
        internal
    {
        require(isNonceValid(wallet, nonce), "INVALID_NONCE");
        nonces[wallet] = nonce;
    }
}
