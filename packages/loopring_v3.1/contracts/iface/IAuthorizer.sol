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


/// @title IAuthorizer
/// @author Brecht Devos - <brecht@loopring.org>
contract IAuthorizer
{
    /// @dev Checks if an address has been authorized.
    /// @param sender The originating address (msg.sender)
    /// @return true if the address is authorized, else false
    function isAuthorized(
        address sender
        )
        external
        returns (bool);

    /// @dev Checks if an address has been authorized for a specific user.
    /// @param sender The originating address (msg.sender)
    /// @param addr The address for which an action will be taken
    /// @return true If the sender address was authorized for the user, else false
    function isAuthorizedFor(
        address sender,
        address addr
        )
        external
        returns (bool);
}
