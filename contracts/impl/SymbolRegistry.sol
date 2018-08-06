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
pragma solidity 0.4.24;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

import "../iface/ISymbolRegistry.sol";
import "../lib/Claimable.sol";
import "../lib/NoDefaultFunc.sol";


/// @title An Implementation of SymbolRegistry.
/// @author Brecht Devos - <brecht@loopring.org>,
contract SymbolRegistry is ISymbolRegistry, Claimable, NoDefaultFunc {

    mapping (string => address) private  symbolToAddressMap;
    mapping (address => string) public  addressToSymbolMap;

    function registerSymbol(
        address addr,
        string  symbol
        )
        onlyOwner
        external
    {
        require(0x0 != addr, "bad address");
        require(bytes(symbol).length > 0, "empty symbol");
        require(0x0 == symbolToAddressMap[symbol], "symbol registered");
        require(0 == bytes(addressToSymbolMap[addr]).length, "address registered");

        addressToSymbolMap[addr] = symbol;
        symbolToAddressMap[symbol] = addr;

        emit SymbolRegistered(addr, symbol);
    }

    function unregisterSymbol(
        address addr
        )
        onlyOwner
        external
    {
        require(addr != 0x0, "bad token address ");

        string storage symbol = addressToSymbolMap[addr];
        require(bytes(symbol).length > 0, "address has no symbol");

        delete symbolToAddressMap[symbol];
        delete addressToSymbolMap[addr];

        emit SymbolUnregistered(addr, symbol);
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
