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


contract BaseVault is Vault, AddressSet
{
    using SignatureUtil for bytes32;

    event OwnerAdded(address indexed owner);
    event OwnerRemoved(address indexed owner);
    event RequirementChanged(uint requirement);
    event Executed(
        address indexed target,
        uint            value,
        bytes           data,
        bool            success
    );

    bytes32 constant internal OWNERS = keccak256("__OWNER__");
    uint    constant public   MAX_OWNERS = 10;

    uint public _requirement;

    modifier onlyFromExecute
    {
        require(msg.sender == address(this), "NOT_FROM_THIS_MODULE");
        _;
    }

    constructor(
        address[] memory owners,
        uint      initialRequirement
        )
        public
    {
        require(owners.length > 0, "NULL_OWNERS");
        require(owners.length <= MAX_OWNERS, "TOO_MANY_OWNERS");

        for (uint i = 0; i < owners.length; i++) {
            address owner = owners[i];
            require(owner != address(0), "ZERO_ADDRESS");
            addAddressToSet(OWNERS, owner, true);
        }
        require(
            initialRequirement > 0 &&
            initialRequirement <= owners.length,
            "INVALID_REQUIREMENT"
        );
        _requirement = initialRequirement;
    }

    function execute(
        address   target,
        uint      value,
        bytes     calldata data,
        address[] calldata signers,
        bytes[]   calldata signatures
        )
        external
    {
        require(signers.length >= _requirement, "NEED_MORE_SIGNATURES");
        bytes32 signHash = getSignHash(
            address(this), // from
            target,
            value,
            data
        );
        signHash.verifySignatures(signers, signatures);
        // solium-disable-next-line security/no-call-value
        (bool success, ) = target.call.value(value)(data);
        emit Executed(target, value, data, success);
    }

    function getSignHash(
        address from,
        address to,
        uint256 value,
        bytes   memory data
        )
        public
        pure
        returns (bytes32)
    {
        bytes32 hash = keccak256(
            abi.encodePacked(
                byte(0x19),
                byte(0),
                from,
                to,
                value,
                keccak256(data)
                )
            );

        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    function addOwner(address owner)
        external
        onlyFromExecute
    {
        addAddressToSet(OWNERS, owner, true);
        emit OwnerAdded(owner);
    }

    function removeOwner(address owner)
        external
        onlyFromExecute
    {
        uint count = numOwners();
        require(count > 1, "PROHIBITED");

        if (_requirement == count) {
            _requirement -= 1;
        }

        removeAddressFromSet(OWNERS, owner);
        emit OwnerRemoved(owner);
    }

    function changeRequirement(uint256 newRequirement)
        external
        onlyFromExecute
    {
        require(
            newRequirement > 0 &&
            newRequirement <= numOwners(),
            "INVALID_REQUIREMENT"
        );
        _requirement = newRequirement;
        emit RequirementChanged(_requirement);
    }

    function requirement()
        public
        view
        returns (uint)
    {
        return _requirement;
    }

    function owners()
        public
        view
        returns (address[] memory)
    {
        return addressesInSet(OWNERS);
    }

    function isOwner(address _addr)
        public
        view
        returns (bool)
    {
        return isAddressInSet(OWNERS, _addr);
    }

    function numOwners()
        public
        view
        returns (uint)
    {
        return numAddressesInSet(OWNERS);
    }
}
