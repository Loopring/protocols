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
pragma solidity ^0.5.13;
pragma experimental ABIEncoderV2;


contract Vault
{
    /// @dev Entrypoint for executing all transactions.
    /// @param target The target address to execute transaction on.
    /// @param value The amoutn of Ether to send to target.
    /// @param data The transaction to execute.
    /// @param signers The addresses that signs the transaction, sorted ascendantly.
    /// @param signatures The signatures matching the signers.
    function execute(
        address   target,
        uint      value,
        bytes     calldata data,
        address[] calldata signers,
        bytes[]   calldata signatures
        ) external;

    /// @dev Adds a new owner.
    /// @param _owner The owner to add.
    function addOwner(address _owner) external;

    /// @dev Removes an existing owner.
    /// @param _owner The owenr to remove.
    function removeOwner(address _owner) external;

    /// @dev Change the number of signatures required to execute transactions.
    /// @param _requirement The new requirement.
    function changeRequirement(uint256 _requirement) external;

    /// @dev Returns the number of signatures required to execute transactions.
    /// @return requirement The requirement.
    function requirement() public view returns (uint _requirement);

    /// @dev Returns the list of owners.
    /// @return _owners The list of owners.
    function owners() public view returns (address[] memory _owners);

    /// @dev Returns if an address is an owner.
    /// @param _addr The address to check.
    /// @return _isOwner True if the address is an owner.
    function isOwner(address _addr) public view returns (bool _isOwner);
}