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

abstract contract MetaTxRelayer {

    struct MetaTx {
        address to;
        bytes   data;
        address from;
        uint    nonce;
        address gasToken;
        uint    gasPrice;
        uint    gasLimit;
    }


    bytes32 constant public META_TX_TYPEHASH = keccak256(
        "MetaTx(address to,bytes data,address from,uint256 nonce,address gasToken,uint256 gasPrice,uint256 gasLimit)"
    );

    bytes32 public DOMAIN_SEPARATOR;


    mapping(address => uint256) public nonces;


    constructor()
        public
    {
        DOMAIN_SEPARATOR = EIP712.hash(EIP712.Domain("Loopring Wallet MetaTx", "2.0", address(this)));
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}

    function getNonce(address from)
        external
        view
        returns(uint)
    {
        return nonces[from];
    }

    function verify(
        MetaTx calldata metaTx,
        bytes  calldata signature
        )
        external
        view
    {
        require(nonces[metaTx.from] == metaTx.nonce, "NONCE_MISMATCH");
        verifySignature(metaTx, signature);
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
        require(nonces[metaTx.from] == metaTx.nonce, "NONCE_MISMATCH");
        verifySignature(metaTx, signature);
        nonces[metaTx.from]++;

        uint gasLeft = gasleft();
        if (beforeExecute(metaTx)) {
            return (false, returnValue);
        }

        (success, returnValue) = metaTx.to.call{gas : metaTx.gasLimit, value : 0}(
            abi.encodePacked(metaTx.data, metaTx.from)
        );

        uint gasUsed = gasLeft - gasleft();
        if (postExecute(metaTx, success, returnValue, gasUsed)) {
            return (false, returnValue);
        }
    }

    function beforeExecute(MetaTx memory metaTx)
        internal
        virtual
        returns(bool abort) {}

    function postExecute(
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
        internal
        view
    {
        bytes memory encoded = abi.encodePacked(
            META_TX_TYPEHASH,
            abi.encode(
                metaTx.to,
                keccak256(metaTx.data),
                metaTx.from,
                metaTx.nonce,
                metaTx.gasToken,
                metaTx.gasPrice,
                metaTx.gasLimit
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, keccak256(encoded)));
        // require(digest.recover(sig) == req.from, "INVALID_SIGNATURE");
    }
}
