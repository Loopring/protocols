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
pragma solidity ^0.5.11;

import "../lib/OwnerManagable.sol";
import "../thirdparty/strings.sol";
import "./ENS.sol";

/// @title Wallet
/// @dev Base contract for smart wallets.
///      Sub-contracts must NOT use non-default constructor to initialize
///      wallet states, instead, `init` shall be used. This is to enable
///      proxies to be deployed in front of the real wallet contract for
///      saving gas.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract ENSManager is OwnerManagable {

    using strings for *;

    // The managed root name
    string public rootName;
    // The managed root node
    bytes32 public rootNode;
    // The address of the ENS resolver
    address public ensResolver;
    // the address of the ENS registry
    address ensRegistry;

    // namehash('addr.reverse')
    bytes32 constant public ADDR_REVERSE_NODE = 0x91d1777781884d03a6757a803996e38de2a42967fb37eeaca72729271025a9e2;

    event Registered(address indexed _owner, string _ens);

    constructor(
        string memory _rootName,
        bytes32 _rootNode,
        address _ensRegistry,
        address _ensResolver
        )
        public
    {
        rootName = _rootName;
        rootNode = _rootNode;
        ensRegistry = _ensRegistry;
        ensResolver = _ensResolver;
    }

    function registerSubdomain(
        string calldata _label,
        address _owner
        )
        external
        onlyManager
    {
        bytes32 labelNode = keccak256(abi.encodePacked(_label));
        bytes32 node = keccak256(abi.encodePacked(rootNode, labelNode));
        address currentOwner = ENSRegistry(ensRegistry).owner(node);
        require(currentOwner == address(0), "ENS_NODE_ALREADY_OWNED");

        // Forward ENS
        ENSRegistry registry = ENSRegistry(ensRegistry);
        registry.setSubnodeOwner(rootNode, labelNode, address(this));
        registry.setResolver(node, ensResolver);
        registry.setOwner(node, _owner);
        ENSResolver(ensResolver).setAddr(node, _owner);

        // Reverse ENS
        strings.slice[] memory parts = new strings.slice[](2);
        parts[0] = _label.toSlice();
        parts[1] = rootName.toSlice();
        string memory name = ".".toSlice().join(parts);

        bytes32 reverseNode = getENSReverseRegistrar().node(_owner);
        ENSResolver(ensResolver).setName(reverseNode, name);

        emit Registered(_owner, name);
    }

    function getENSReverseRegistrar() internal view returns (ENSReverseRegistrar) {
        return ENSReverseRegistrar(ENSRegistry(ensRegistry).owner(ADDR_REVERSE_NODE));
    }
}
