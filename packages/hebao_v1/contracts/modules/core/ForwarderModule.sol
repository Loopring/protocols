// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/SignatureUtil.sol";
import "../../thirdparty/BytesUtil.sol";
import "../base/BaseModule.sol";


/// @title ForwarderModule
/// @dev Base contract for all smart wallet modules.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract ForwarderModule is BaseModule
{
    using SignatureUtil for bytes32;
    using BytesUtil     for bytes;

    uint    public constant GAS_OVERHEAD = 100000;
    bytes32 public DOMAIN_SEPARATOR;

    constructor(ControllerImpl _controller)
        public
        BaseModule(_controller)
    {
        DOMAIN_SEPARATOR = EIP712.hash(
            EIP712.Domain("ForwarderModule", "1.1.0", address(this))
        );
    }

    event MetaTxExecuted(
        address indexed relayer,
        address indexed from,
        uint            nonce,
        bool            success,
        uint            gasUsed
    );

    struct MetaTx {
        address from;
        address to;
        uint    nonce;
        address gasToken;
        uint    gasPrice;
        uint    gasLimit;
        bytes32 txAwareHash;
        bytes   data;
    }

    bytes32 constant public META_TX_TYPEHASH = keccak256(
        "MetaTx(address from,address to,uint256 nonce,address gasToken,uint256 gasPrice,uint256 gasLimit,bytes32 txAwareHash,bytes data)"
    );

    function validateMetaTx(
        address from,
        address to,
        uint    nonce,
        address gasToken,
        uint    gasPrice,
        uint    gasLimit,
        bytes32 txAwareHash,
        bytes   memory data,
        bytes   memory signature
        )
        public
        view
    {
        require(
            to == controller.walletFactory() || // 'from' can be the wallet to create (not its owner),
                                                // or an existing wallet,
                                                // or an EOA iff gasPrice == 0
            controller.moduleRegistry().isModuleRegistered(to) && (to != address(this)) ||
            controller.walletRegistry().isWalletRegistered(from) && (to == from),
            "INVALID_DESTINATION"
        );
        require(nonce == 0 || txAwareHash == 0, "INVALID_NONCE");

        bytes memory data_ = txAwareHash == 0 ? data : data.slice(0, 4); // function selector

        bytes memory encoded = abi.encode(
            META_TX_TYPEHASH,
            from,
            to,
            nonce,
            gasToken,
            gasPrice,
            gasLimit,
            txAwareHash,
            keccak256(data_)
        );

        bytes32 metaTxHash = EIP712.hashPacked(DOMAIN_SEPARATOR, encoded);
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

        require(
            gasLeft >= (metaTx.gasLimit.mul(64) / 63).add(GAS_OVERHEAD),
            "INSUFFICIENT_GAS"
        );

        validateMetaTx(
            metaTx.from,
            metaTx.to,
            metaTx.nonce,
            metaTx.gasToken,
            metaTx.gasPrice,
            metaTx.gasLimit,
            metaTx.txAwareHash,
            metaTx.data,
            signature
        );

        // The trick is to append the really logical message sender and the
        // transaction-aware hash to the end of the call data.
        (success, ret) = metaTx.to.call{gas : metaTx.gasLimit, value : 0}(
            abi.encodePacked(metaTx.data, metaTx.from, metaTx.txAwareHash)
        );

        bool waiveFees = false;
        if (metaTx.txAwareHash == 0) {
            controller.nonceStore().verifyAndUpdate(metaTx.from, metaTx.nonce);
        } else if (success) {
            controller.hashStore().verifyAndUpdate(metaTx.from, metaTx.txAwareHash);
        } else {
            // The relayer can provide invalid metaTx.data to make this meta-tx fail,
            // therefore we we need to prevent the relayer from chareging the meta-tx
            // fees from the wallet owner.
            waiveFees = true;
        }

        if (address(this).balance > 0) {
            payable(controller.collectTo()).transfer(address(this).balance);
        }

        uint gasUsed = gasLeft - gasleft();

        emit MetaTxExecuted(
            msg.sender,
            metaTx.from,
            metaTx.nonce,
            success,
            gasUsed
        );

        if (metaTx.gasPrice > 0 && !waiveFees) {
            uint gasAmount = gasUsed < metaTx.gasLimit ? gasUsed : metaTx.gasLimit;
            reimburseGasFee(
                metaTx.from,
                controller.collectTo(),
                metaTx.gasToken,
                metaTx.gasPrice,
                gasAmount.add(GAS_OVERHEAD)
            );
        }

    }
}
