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


/// @title ISymbolRegistry
/// @dev This contract maintains a mapping between tokens and their symbol.
/// @author Brecht Devos - <brecht@loopring.org>
contract ISymbolRegistry {

    event SymbolRegistered(
        address indexed addr,
        string          symbol
    );

    event SymbolUnregistered(
        address indexed addr,
        string          symbol
    );

    function registerSymbol(
        address addr,
        string  symbol
        )
        external;

    function unregisterSymbol(
        address addr
        )
        external;

    function getAddressBySymbol(
        string symbol
        )
        external
        view
        returns (address);

    function getSymbolByAddress(
        address addr
        )
        external
        view
        returns (string);
}
