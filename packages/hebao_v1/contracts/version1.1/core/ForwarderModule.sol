
/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/SignatureUtil.sol";
import "../base/BaseModule.sol";


/// @title ForwarderModule
/// @dev Base contract for all smart wallet modules.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract ForwarderModule is BaseModule
{
    using SignatureUtil for bytes32;

    // TODO(kongliang):figure out this GAS_OVERHEAD value.
    uint    public constant GAS_OVERHEAD = 200000;
    bytes32 public DOMAIN_SEPARATOR;

    constructor(ControllerImpl _controller)
        public
        BaseModule(_controller)
    {
        DOMAIN_SEPARATOR = EIP712.hash(
            EIP712.Domain("Loopring Wallet MetaTx", "2.0", address(0))
        );
    }

    event MetaTxExecuted(
        address indexed relayer,
        address indexed from,
        uint            nonce
    );

    struct MetaTx {
        address from;
        address to;
        uint    nonce;
        address gasToken;
        uint    gasPrice;
        uint    gasLimit;
        bytes32 txInnerHash;
        bytes   data;
    }

    bytes32 constant public META_TX_TYPEHASH = keccak256(
        "MetaTx(address from,address to,uint256 nonce,address gasToken,uint256 gasPrice,uint256 gasLimit,bytes32 txInnerHash,bytes data)"
    );

    function validateMetaTx(
        address from,
        address to,
        uint    nonce,
        address gasToken,
        uint    gasPrice,
        uint    gasLimit,
        bytes32 txInnerHash,
        bytes   memory data,
        bytes   memory signature
        )
        public
        view
    {
        require(to != address(this) && Wallet(from).hasModule(to), "INVALID_DESTINATION");

        // If a non-zero txInnerHash is provided, we do not verify signature against
        // the `data` field. The actual function call in the real transaction will have to
        // check that txInnerHash is indeed valid.
        bytes memory data_ = (txInnerHash == 0) ? data : bytes("");
        bytes memory encoded = abi.encode(
            META_TX_TYPEHASH,
            from,
            to,
            nonce,
            gasToken,
            gasPrice,
            gasLimit,
            txInnerHash,
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
            bytes memory returnValue
        )
    {
        require(
            gasleft() >= (metaTx.gasLimit.mul(64) / 63).add(GAS_OVERHEAD),
            "INSUFFICIENT_GAS"
        );

        controller.nonceStore().verifyAndUpdate(metaTx.from, metaTx.nonce);

        validateMetaTx(
            metaTx.from,
            metaTx.to,
            metaTx.nonce,
            metaTx.gasToken,
            metaTx.gasPrice,
            metaTx.gasLimit,
            metaTx.txInnerHash,
            metaTx.data,
            signature
        );

        uint gasLeft = gasleft();

        (success, returnValue) = metaTx.to.call{gas : metaTx.gasLimit, value : 0}(
            abi.encodePacked(metaTx.data, metaTx.from, metaTx.txInnerHash)
            // encode or encodePacked? @Brecht
        );

        if (address(this).balance > 0) {
            payable(controller.collectTo()).transfer(address(this).balance);
        }

        emit MetaTxExecuted(msg.sender, metaTx.from, metaTx.nonce);

        uint gasUsed = gasLeft - gasleft();
        uint gasAmount = gasUsed < metaTx.gasLimit ? gasUsed : metaTx.gasLimit;

        if (metaTx.gasPrice > 0) {
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
