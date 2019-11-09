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

import "./Ownable.sol";


/// @title OwnableWithDelegates
/// @author Daniel Wang - <daniel@loopring.org>
/// @dev The OwnableWithDelegates contract has an owner address and an optional
///      deletate for any roles.
contract OwnableWithDelegates is Ownable
{
    mapping (string => address) public delegates;

    event DelegateUpdated(string role, address delegate);

    constructor() Ownable() public {}

    /// @dev Throws if called by any account other than the owner or the delegate.
    modifier onlyOwnerOrDelegate(string memory role)
    {
        require(msg.sender == owner || msg.sender == delegates[role], "UNAUTHORIZED");
        _;
    }

    /// @dev Set the delegate's address for the specified role.
    /// @param role The role of the delegate
    /// @param delegate The address of the new delegate.
    function setDelegate(
        string  memory role,
        address delegate
        )
        public
        onlyOwner
    {
        require(bytes(role).length != 0, "EMPTY_ROLE");
        emit DelegateUpdated(role, delegate);
        delegates[role] = delegate;
    }
}
