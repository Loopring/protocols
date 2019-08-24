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
pragma solidity 0.5.7;

import "../iface/Errors.sol";
import "./ITransferableMultsig.sol";


/// @title An Implementation of ITransferableMultsig
/// @author Daniel Wang - <daniel@loopring.org>.
contract TransferableMultsig is ITransferableMultsig, Errors {

    uint public nonce;                  // (only) mutable state
    uint public threshold;              // immutable state
    mapping (address => bool) ownerMap; // immutable state
    address[] public owners;            // immutable state

    constructor(
        uint             _threshold,
        address[] memory _owners
        )
        public
    {
        updateOwners(_threshold, _owners);
    }

    // default function does nothing.
    function ()
        external
        payable
    {
    }

    function execute(
        uint8[] calldata   sigV,
        bytes32[] calldata sigR,
        bytes32[] calldata sigS,
        address            destination,
        uint               value,
        bytes calldata     data
        )
        external
    {
        // Follows ERC191 signature scheme:
        //    https://github.com/ethereum/EIPs/issues/191
        bytes32 txHash = keccak256(
            abi.encodePacked(
                byte(0x19),
                byte(0),
                this,
                nonce++,
                destination,
                value,
                data
            )
        );

        verifySignatures(
            sigV,
            sigR,
            sigS,
            txHash
        );

        (bool success, ) = destination.call.value(value)(data);
        require(success, "execution error");
    }

    function transferOwnership(
        uint8[] calldata   sigV,
        bytes32[] calldata sigR,
        bytes32[] calldata sigS,
        uint               _threshold,
        address[] calldata _owners
        )
        external
    {
        // Follows ERC191 signature scheme:
        //    https://github.com/ethereum/EIPs/issues/191
        bytes32 txHash = keccak256(
            abi.encodePacked(
                byte(0x19),
                byte(0),
                this,
                nonce++,
                _threshold,
                _owners
            )
        );

        verifySignatures(
            sigV,
            sigR,
            sigS,
            txHash
        );
        updateOwners(_threshold, _owners);
    }

    function verifySignatures(
        uint8[] memory   sigV,
        bytes32[] memory sigR,
        bytes32[] memory sigS,
        bytes32          txHash
        )
        internal
        view
    {
        uint _threshold = threshold;
        require(_threshold == sigR.length, INVALID_SIZE);
        require(_threshold == sigS.length, INVALID_SIZE);
        require(_threshold == sigV.length, INVALID_SIZE);

        address lastAddr = address(0x0); // cannot have 0x0 as an owner
        for (uint i = 0; i < threshold; i++) {
            address recovered = ecrecover(
                txHash,
                sigV[i],
                sigR[i],
                sigS[i]
            );

            require(recovered > lastAddr && ownerMap[recovered], INVALID_ADDRESS);
            lastAddr = recovered;
        }
    }

    function updateOwners(
        uint             _threshold,
        address[] memory _owners
        )
        internal
    {
        require(_owners.length <= 10, INVALID_SIZE);
        require(_threshold <= _owners.length, INVALID_SIZE);
        require(_threshold != 0, INVALID_VALUE);

        // remove all current owners from ownerMap.
        address[] memory currentOwners = owners;
        for (uint i = 0; i < currentOwners.length; i++) {
            ownerMap[currentOwners[i]] = false;
        }

        address lastAddr = address(0x0);
        for (uint i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner > lastAddr, INVALID_ADDRESS);

            ownerMap[owner] = true;
            lastAddr = owner;
        }
        owners = _owners;
        threshold = _threshold;
    }
}
