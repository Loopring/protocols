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
pragma solidity 0.4.15;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";


/// @title Token Register Contract
/// @author Kongliang Zhong - <kongliang@loopring.org>,
/// @author Daniel Wang - <daniel@loopring.org>.
contract TokenRegistry is Ownable {

    mapping (string => address) tokenSymbolMap;

    mapping (address => bool) tokenAddressMap;

    function registerToken(address _token, string _symbol)
        public
        onlyOwner
    {
        require(_token != address(0));
        require(!isTokenRegisteredBySymbol(_symbol));
        require(!isTokenRegistered(_token));
        tokenSymbolMap[_symbol] = _token;
        tokenAddressMap[_token] = true;
    }

    function unregisterToken(address _token, string _symbol)
        public
        onlyOwner
    {
        require(tokenSymbolMap[_symbol] == _token);
        require(tokenAddressMap[_token] == true);
        delete tokenSymbolMap[_symbol];
        delete tokenAddressMap[_token];
    }

    function isTokenRegisteredBySymbol(string symbol)
        public
        constant
        returns (bool)
    {
        return tokenSymbolMap[symbol] != address(0);
    }

    function isTokenRegistered(address _token)
        public
        constant
        returns (bool)
    {
        return tokenAddressMap[_token];
    }

    function getAddressBySymbol(string symbol)
        public
        constant
        returns (address)
    {
        return tokenSymbolMap[symbol];
    }

}
