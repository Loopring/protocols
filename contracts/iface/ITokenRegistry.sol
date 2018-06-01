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


/// @title ITokenRegistry
/// @dev This contract maintains a list of tokens the Protocol supports.
/// @author Kongliang Zhong - <kongliang@loopring.org>,
/// @author Daniel Wang - <daniel@loopring.org>.
contract ITokenRegistry {

    address[] public agencies;
    address[] public tokens;


    event AgencyRegistered(
        address indexed agency
    );

    event AgencyUnregistered(
        address indexed agency
    );

    event AllAgenciesUnregistered(
    );

    event TokenRegistered(
        address indexed addr,
        string          symbol
    );

    event TokenUnregistered(
        address indexed addr,
        string          symbol
    );

    function registerAgency(
        address agency
        )
        external;

    function unregisterAgency(
        address agency
        )
        external;

    function unregisterAllAgencies(
        )
        external;

    function registerToken(
        address addr,
        string  symbol
        )
        external;

    function unregisterToken(
        address addr
        )
        external;

    function areAllTokensRegistered(
        address[] addressList
        )
        external
        view
        returns (bool);

    function getAddressBySymbol(
        string symbol
        )
        external
        view
        returns (address);

    function getSymbolByAddress(
        string symbol
        )
        external
        view
        returns (address);
}
