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


/// @title ReentrancyGuard
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev Exposes a modifier that guards a function against reentrancy
///      Changing the value of the same storage value multiple times in a transaction
///      is cheap (starting from Istanbul) so there is no need to minimize
///      the number of times the value is changed
contract ReentrancyGuard
{
    //The default value must be 0 in order to work behind a proxy.
    bytes4[] private _callstack;

    //TODO: It will great if we have a way to get the current selector

    // use 0 to represent an internal method selector.
    modifier nonReentrant(bytes4 _selector)
    {
        require(_callstack.length == 0, "REENTRANCY");

        _callstack.push(_selector);
        _;
        _callstack.pop();
    }

    modifier reentrantWhitelist(bytes4 _selector, bytes4 whitelistSelectors)
    {
        require(_selector != bytes4(0));
        uint len = _callstack.length;
        require(
            len == 0 || itemInSet(_callstack[len - 1], whitelistSelectors),
            "WHITELISTE_REENTRANCY"
        );

        _callstack.push(_selector);
        _;
        _callstack.pop();
    }


    modifier reentrantBlacklist(bytes4 _selector, bytes4 blacklistSelectors)
    {
        require(_selector != bytes4(0));
        uint len = _callstack.length;
        require(
            len == 0 || !itemInSet(_callstack[len - 1], blacklistSelectors),
            "BLACKLISTE_REENTRANCY"
        );

        _callstack.push(_selector);
        _;
        _callstack.pop();
    }

    function itemInSet(bytes4 item, bytes4 set)
        private
        returns (bool)
    {
        return item & set == item;
    }

}
