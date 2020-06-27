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

import "../../iface/Wallet.sol";
import "../../lib/EIP712.sol";
import "../../lib/SignatureUtil.sol";


abstract contract Forwarder {
    using SignatureUtil for bytes32;

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
        bytes   data;
    }

    bytes32 constant public META_TX_TYPEHASH = keccak256(
        "MetaTx(address from,address to,uint256 nonce,address gasToken,uint256 gasPrice,uint256 gasLimit,bytes data)"
    );

    bytes32 public DOMAIN_SEPARATOR;
    mapping(address => uint256) public nonces;

    constructor()
        public
    {
        DOMAIN_SEPARATOR = EIP712.hash(EIP712.Domain("Loopring Wallet MetaTx", "2.0", address(this)));
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {} // TODO:testing

    function getNonce(address from)
        external
        view
        returns(uint)
    {
        return nonces[from];
    }

    function execute(
        MetaTx calldata metaTx,
        bytes  calldata signature
        )
        external
        payable
        returns (
            bool         success,
            bytes memory returnValue
        )
    {
        require(msg.value == 0, "INVALID_VALUE"); // TODO: shall we check this?
        require(metaTx.to != address(this), "CANNOT_FORWARD_TO_SELF");
        require((metaTx.nonce >> 128) <= (block.number), "NONCE_TOO_LARGE");
        require(metaTx.nonce > nonces[metaTx.from], "NONCE_TOO_SMALL");
        nonces[metaTx.from] = metaTx.nonce;

        verifySignature(metaTx, signature);

        uint gasLeft = gasleft();
        if (beforeExecute(metaTx)) {
            return (false, returnValue);
        }

        (success, returnValue) = metaTx.to.call{gas : metaTx.gasLimit, value : 0}(
            abi.encodePacked(metaTx.data, metaTx.from)
        );

        if (address(this).balance > 0) {
            payable(msg.sender).transfer(address(this).balance); 
            // TODO:
            // showe we send any ether to msg.sender or metaTx.from????
        }

        emit MetaTxExecuted(msg.sender, metaTx.from, metaTx.nonce);

        uint gasUsed = gasLeft - gasleft();
        if (afterExecute(metaTx, success, returnValue, gasUsed)) {
            return (false, returnValue);
        }
    }

    function beforeExecute(MetaTx memory metaTx)
        internal
        virtual
        returns(bool abort) {}

    function afterExecute(
        MetaTx memory metaTx,
        bool          success,
        bytes memory  returnValue,
        uint          gasUsed
        )
        internal
        virtual
        returns(bool abort) {}

    function verifySignature(
        MetaTx memory metaTx,
        bytes  memory signature
        )
        private
        view
    {
        bytes memory encoded = abi.encodePacked(
            META_TX_TYPEHASH,
            metaTx.from,
            metaTx.to,
            metaTx.nonce,
            metaTx.gasToken,
            metaTx.gasPrice,
            metaTx.gasLimit,
            keccak256(metaTx.data)
        );

        bytes32 metaTxHash = EIP712.hashPacked(DOMAIN_SEPARATOR, keccak256(encoded));
        require(metaTxHash.verifySignature(metaTx.from, signature), "INVALID_SIGNATURE");
    }

}
