// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/MathUint.sol";
import "../../base/WalletDataLayout.sol";
import "../../iface/IVersion.sol";
import "../data/GuardianData.sol";
import "../data/OracleData.sol";
import "../data/QuotaData.sol";
import "../data/SecurityData.sol";
import "./BaseTransferModule.sol";


/// @title MetaTxModule
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
contract MetaTxModule is BaseTransferModule
{
    using QuotaData     for WalletDataLayout.State;
    using OracleData    for WalletDataLayout.State;
    using GuardianData  for WalletDataLayout.State;
    using SecurityData  for WalletDataLayout.State;
    using AddressUtil   for address;
    using BytesUtil     for bytes;
    using MathUint      for uint;
    using SignatureUtil for bytes32;

    uint    public constant MAX_REIMBURSTMENT_OVERHEAD = 63000;

    bytes32 public constant META_TX_TYPEHASH = keccak256(
        "MetaTx(uint256 nonce,bytes32 txAwareHash,address gasToken,uint256 gasPrice,uint256 gasLimit,bytes data)"
    );

// TODO
    mapping(address => uint) public nonces;
    address walletFactory;
    address feeCollector;

    event MetaTxExecuted(
        uint    nonce,
        bytes32 txAwareHash,
        bool    success,
        uint    gasUsed
    );

    struct MetaTx {
        uint    nonce;
        bytes32 txAwareHash;
        address gasToken;
        uint    gasPrice;
        uint    gasLimit;
    }

    function bindableMethods()
        public
        override
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](5);
        methods[0] = this.lastNonce.selector;
        methods[1] = this.isNonceValid.selector;
        methods[2] = this.validateMetaTx.selector;
        methods[3] = this.executeMetaTx.selector;
        methods[4] = this.batchCall.selector;
    }

    function lastNonce()
        public
        view
        returns (uint)
    {
        // return nonces[wallet];
    }

    function isNonceValid(uint nonce)
        public
        view
        returns (bool)
    {
        // return nonce > nonces[wallet] && (nonce >> 128) <= block.number;
    }

    function validateMetaTx(
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
        require(msg.sender != address(this), "PROHIBITED");
        require(nonce == 0 && txAwareHash != 0 || nonce != 0 && txAwareHash == 0, "INVALID_NONCE");

        bytes memory data_ = txAwareHash == 0 ? data : data.slice(0, 4); // function selector
        bytes memory encoded = abi.encode(
            META_TX_TYPEHASH,
            nonce,
            txAwareHash,
            gasToken,
            gasPrice,
            gasLimit,
            keccak256(data_)
        );

        require(!state.isLocked(), "WALLET_LOCKED");
        bytes32 metaTxHash = EIP712.hashPacked(thisWallet().domainSeperator(), encoded);
        require(metaTxHash.verifySignature(thisWallet().owner(), signature), "INVALID_SIGNATURE");
    }

    function executeMetaTx(
        uint    nonce,
        bytes32 txAwareHash,
        address gasToken,
        uint    gasPrice,
        uint    gasLimit,
        bytes   calldata data,
        bytes   calldata signature
        )
        external
        returns (bool success)
    {
        uint gasLeft = gasleft();
        require(gasLeft >= (gasLimit.mul(64) / 63), "OPERATOR_INSUFFICIENT_GAS");

        MetaTx memory metaTx = MetaTx(nonce, txAwareHash, gasToken, gasPrice, gasLimit);

        // Update the nonce before the call to protect against reentrancy
        if (metaTx.nonce != 0) {
            require(isNonceValid(metaTx.nonce), "INVALID_NONCE");
            // nonces[metaTx.from] = metaTx.nonce;
        }

        // The trick is to append the really logical message sender and the
        // transaction-aware hash to the end of the call data.

        (success, ) = address(this).call{gas : metaTx.gasLimit, value : 0}(
            abi.encodePacked(data, address(this), metaTx.txAwareHash)
        );

        // It's ok to do the validation after the 'call'. This is also necessary
        // in the case of creating the wallet, otherwise, wallet signature validation
        // will fail before the wallet is created.
        validateMetaTx(
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

            if (metaTx.gasToken == address(0)) {
                gasUsed -= 15000; // diff between an regular ERC20 transfer and an ETH send
            }

            uint gasToReimburse = gasUsed <= metaTx.gasLimit ? gasUsed : metaTx.gasLimit;

            _reimburseGasFee(metaTx.gasToken, metaTx.gasPrice, gasToReimburse);
        }

        emit MetaTxExecuted(
            metaTx.nonce,
            metaTx.txAwareHash,
            success,
            gasUsed
        );
    }

    function batchCall(
        address[] calldata to,
        bytes[]   calldata data
        )
        external
        txAwareHashNotAllowed
        onlyFromWalletOrOwnerWhenUnlocked
    {
        require(to.length == data.length, "INVALID_DATA");

        for (uint i = 0; i < to.length; i++) {
            require(to[i] != address(this), "INVALID_TARGET");
            (bool success, ) = to[i].call{value: 0}(data[i]);
            require(success, "BATCHED_CALL_FAILED");
        }
    }

    function _reimburseGasFee(
        address     gasToken,
        uint        gasPrice,
        uint        gasAmount
        )
        internal
    {
        uint gasCost = gasAmount.mul(gasPrice);
        state.checkAndAddToSpent(gasToken, gasAmount, state.priceOracle());
        _transferTokenInternal(gasToken, msg.sender, gasCost);
    }
}
