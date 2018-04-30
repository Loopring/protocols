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
import "./ITokenRegistry.sol";


/// @title An Implementation of TokenRegistry.
/// @author Kongliang Zhong - <kongliang@loopring.org>,
/// @author Daniel Wang - <daniel@loopring.org>.
contract TokenRegistry is ITokenRegistry, Claimable {
    using AddressUtil for address;

    address[] public agencies;
    mapping (address => uint) agencyPosMap;

    address[] public tokens;
    mapping (address => Token) addressMap;
    mapping (string => address) symbolMap;

    struct Token {
        uint   pos;      // 0 mens unregistered; if > 0, pos - 1 is the
                         // token's position in `tokens`.
        string symbol;   // Symbol of the token
    }

    /// @dev Disable default function.
    function ()
        payable
        external
    {
        revert();
    }

    function registerAgency(
        address agency
        )
        onlyOwner
        external
    {
        require(0x0 != agency, "bad agency");
        require(
            0 == agencyPosMap[agency],
            "agency already exists"
        );

        agencies.push(agency);
        agencyPosMap[agency] = agencies.length;

        emit AgencyRegistered(agency);
    }

    function unregisterAgency(
        address agency
        )
        onlyOwner
        external 
    {
        require(0x0 != agency, "bad agency");

        uint pos = agencyPosMap[agency];
        require(pos != 0, "agency not exists");

        if (pos != agencies.length) {
            agencies[pos - 1] = agencies[agencies.length - 1];
        }

        agencies.length--;
        delete agencyPosMap[agency];

        emit AgencyUnregistered(agency);
    }

    function unregisterAllAgencies(
        )
        onlyOwner
        external
    {
        for (uint i = 0; i < agencies.length; i++) {
            delete agencyPosMap[agencies[i]];
        }
        agencies.length = 0;

        emit AllAgenciesUnregistered();
    }

    function getAngencies(
        uint start,
        uint count
        )
        public
        view
        returns (address[] agencyList)
    {
        uint num = agencies.length;

        if (start >= num) {
            return;
        }

        uint end = start + count;
        if (end > num) {
            end = num;
        }

        if (start == end) {
            return;
        }

        agencyList = new address[](end - start);
        for (uint i = start; i < end; i++) {
            agencyList[i - start] = agencies[i];
        }
    }

    function registerToken(
        address addr,
        string  symbol
        )
        external
    {
        require(
            msg.sender == owner || agencyPosMap[msg.sender] != 0,
            "unauthenticated"
        );
        require(0x0 != addr, "bad address");
        require(bytes(symbol).length > 0, "empty symbol");
        require(0x0 == symbolMap[symbol], "symbol registered");
        require(0 == addressMap[addr].pos, "address registered");

        tokens.push(addr);
        symbolMap[symbol] = addr;
        addressMap[addr] = Token(tokens.length, symbol);

        emit TokenRegistered(addr, symbol);
    }

    function unregisterToken(
        address addr,
        string  symbol
        )
        external
        onlyOwner
    {
        require(addr != 0x0, "bad token address ");
        require(symbolMap[symbol] == addr, "token not found");
       

        uint pos = addressMap[addr].pos;
        require(pos != 0);
        // We will replace the token we need to unregister with the last token
        // Only the pos of the last token will need to be updated
        address lastToken = tokens[tokens.length - 1];

        // Don't do anything if the last token is the one we want to delete
        if (addr != lastToken) {
            // Swap with the last token and update the pos
            tokens[pos - 1] = lastToken;
            addressMap[lastToken].pos = pos;
        }

        tokens.length--;
        delete addressMap[addr];
        delete symbolMap[symbol];

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
        uint num = tokens.length;

        if (start >= num) {
            return;
        }

        uint end = start + count;
        if (end > num) {
            end = num;
        }

        if (start == end) {
            return;
        }

        addressList = new address[](end - start);
        for (uint i = start; i < end; i++) {
            addressList[i - start] = tokens[i];
        }
    }
}
