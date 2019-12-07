/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless _requirement by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "../lib/AddressSet.sol";
import "../lib/SignatureUtil.sol";

import "../iface/Vault.sol";


contract ERC712
{
    struct Domain {
        string  name;
        string  version;
        address verifyingContract;
        uint    salt;
    }

    bytes32 constant internal EIP712DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,uint256 salt)"
    );

    function hash(Domain memory domain)
        internal
        pure
        returns (bytes32)
    {
        uint _chainid;

        // TODO(daniel): uncomment the following line and enable `--evm-version istanbul`
        // assembly { _chainid := chainid() }

        return keccak256(abi.encode(
            EIP712DOMAIN_TYPEHASH,
            keccak256(bytes(domain.name)),
            keccak256(bytes(domain.version)),
            _chainid,
            domain.verifyingContract,
            domain.salt
        ));
    }
}