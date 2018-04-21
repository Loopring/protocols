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
pragma solidity 0.4.23;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

import "./lib/AddressUtil.sol";
import "./lib/Claimable.sol";
import "./TokenRegistry.sol";


/// @title An Implementation of TokenRegistry.
/// @author Kongliang Zhong - <kongliang@loopring.org>,
/// @author Daniel Wang - <daniel@loopring.org>.
contract TokenRegistryImpl is TokenRegistry, Claimable {
    using AddressUtil for address;

    address[] public addresses;
    mapping (address => TokenInfo) addressMap;
    mapping (string => address) symbolMap;

    struct TokenInfo {
        uint   pos;      // 0 mens unregistered; if > 0, pos - 1 is the
                         // token's position in `addresses`.
        string symbol;   // Symbol of the token
    }

    /// @dev Disable default function.
    function ()
        payable
        external
    {
        revert();
    }

    function registerToken(
        address addr,
        string  symbol
        )
        external
        onlyOwner
    {
        registerTokenInternal(addr, symbol);
    }

    function registerMintedToken(
        address addr,
        string  symbol
        )
        external
    {
        registerTokenInternal(addr, symbol);
    }

    function unregisterToken(
        address addr,
        string  symbol
        )
        external
        onlyOwner
    {
        require(addr != 0x0,"bad address");
        require(symbolMap[symbol] == addr, "token not found");
        delete symbolMap[symbol];

        uint pos = addressMap[addr].pos;
        require(pos != 0);
        delete addressMap[addr];

        // We will replace the token we need to unregister with the last token
        // Only the pos of the last token will need to be updated
        address lastToken = addresses[addresses.length - 1];

        // Don't do anything if the last token is the one we want to delete
        if (addr != lastToken) {
            // Swap with the last token and update the pos
            addresses[pos - 1] = lastToken;
            addressMap[lastToken].pos = pos;
        }
        addresses.length--;

        emit TokenUnregistered(addr, symbol);
    }

    function areAllTokensRegistered(
        address[] addressList
        )
        external
        view
        returns (bool)
    {
        for (uint i = 0; i < addressList.length; i++) {
            if (addressMap[addressList[i]].pos == 0) {
                return false;
            }
        }
        return true;
    }

    function getAddressBySymbol(
        string symbol
        )
        external
        view
        returns (address)
    {
        return symbolMap[symbol];
    }

    function isTokenRegisteredBySymbol(
        string symbol
        )
        public
        view
        returns (bool)
    {
        return symbolMap[symbol] != 0x0;
    }

    function isTokenRegistered(
        address addr
        )
        public
        view
        returns (bool)
    {
        return addressMap[addr].pos != 0;
    }

    function getTokens(
        uint start,
        uint count
        )
        public
        view
        returns (address[] addressList)
    {
        uint num = addresses.length;

        if (start >= num) {
            return;
        }

        uint end = start + count;
        if (end > num) {
            end = num;
        }

        if (start == num) {
            return;
        }

        addressList = new address[](end - start);
        for (uint i = start; i < end; i++) {
            addressList[i - start] = addresses[i];
        }
    }

    // address[] public addresses;
    // mapping (address => TokenInfo) addressMap;
    // mapping (string => address) symbolMap;

    // struct TokenInfo {
    //     uint   pos;      // 0 mens unregistered; if > 0, pos - 1 is the
    //                      // token's position in `addresses`.
    //     string symbol;   // Symbol of the token
    // }


    function registerTokenInternal(
        address addr,
        string  symbol
        )
        internal
    {
        require(0x0 != addr, "bad address");
        require(bytes(symbol).length > 0, "empty symbol");
        require(0x0 == symbolMap[symbol], "symbol registered");
        require(0 == addressMap[addr].pos, "address registered");

        addresses.push(addr);
        symbolMap[symbol] = addr;
        addressMap[addr] = TokenInfo(addresses.length, symbol);

        emit TokenRegistered(addr, symbol);
    }
}
