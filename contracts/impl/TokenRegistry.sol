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

import "../iface/ITokenRegistry.sol";
import "../lib/AddressUtil.sol";
import "../lib/Claimable.sol";
import "../lib/NoDefaultFunc.sol";


/// @title An Implementation of TokenRegistry.
/// @author Kongliang Zhong - <kongliang@loopring.org>,
/// @author Daniel Wang - <daniel@loopring.org>.
contract TokenRegistry is ITokenRegistry, Claimable, NoDefaultFunc {
    using AddressUtil for address;

    mapping (address => uint)   private agencyPosMap;
    mapping (address => uint)   private tokenPosMap;
    mapping (address => string) public  addressToSymbolMap;
    mapping (string => address) public  symbolToAddressMap;

    function registerAgency(
        address agency
        )
        onlyOwner
        external
    {
        require(agency.isContract(), "bad agency");
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

        uint size = agencies.length;
        if (pos != size) {
            address lastOne = agencies[size - 1];
            agencies[pos - 1] = lastOne;
            agencyPosMap[lastOne] = pos;
        }

        agencies.length -= 1;
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
        require(0x0 == symbolToAddressMap[symbol], "symbol registered");
        require(0 == bytes(addressToSymbolMap[addr]).length, "address registered");

        tokens.push(addr);
        tokenPosMap[addr] = tokens.length;
        addressToSymbolMap[addr] = symbol;
        symbolToAddressMap[symbol] = addr;

        emit TokenRegistered(addr, symbol);
    }

    function unregisterToken(
        address addr
        )
        external
        onlyOwner
    {
        require(addr != 0x0, "bad token address ");

        uint pos = tokenPosMap[addr];
        require(pos != 0, "token not found");

        uint size = tokens.length;
        if (pos != size) {
            address lastOne = tokens[size - 1];
            tokens[pos - 1] = lastOne;
            tokenPosMap[lastOne] = pos;
        }
        tokens.length -= 1;

        string storage symbol = addressToSymbolMap[addr];

        delete symbolToAddressMap[symbol];
        delete addressToSymbolMap[addr];
        delete tokenPosMap[addr];

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
            if (tokenPosMap[addressList[i]] == 0) {
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
        return symbolToAddressMap[symbol];
    }

    function getSymbolByAddress(
        address addr
        )
        external
        view
        returns (string)
    {
        return addressToSymbolMap[addr];
    }
}
