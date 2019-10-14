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
pragma experimental ABIEncoderV2;

import "../iface/IAuthorizable.sol";


/// @title Authorizable
/// @author Brecht Devos - <brecht@loopring.org>
contract Authorizable is IAuthorizable
{
    modifier onlyAuthorized()
    {
        require(
            (authorizer != IAuthorizer(address(0)) && authorizer.isAuthorized(msg.sender)),
            "UNAUTHORIZED"
        );
        _;
    }

    modifier onlyAuthorizedFor(address owner)
    {
        require(
            msg.sender == owner ||
            (authorizer != IAuthorizer(address(0)) && authorizer.isAuthorizedFor(msg.sender, owner)),
            "UNAUTHORIZED"
        );
        _;
    }

    function setAuthorizer(
        IAuthorizer _authorizer
        )
        external
        onlyExchangeOwner
    {
        authorizer = _authorizer;
    }
}