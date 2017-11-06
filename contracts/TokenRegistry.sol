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
pragma solidity 0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";


/// @title Token Register Contract
/// @author Kongliang Zhong - <kongliang@loopring.org>,
/// @author Daniel Wang - <daniel@loopring.org>.
contract TokenRegistry is Ownable {

    address[] public tokens;

    mapping (address => bool) tokenMap;

    mapping (string => address) tokenSymbolMap;

    function registerToken(address _token, string _symbol)
        public
        onlyOwner
    {
        require(_token != address(0));
        require(!isTokenRegisteredBySymbol(_symbol));
        require(!isTokenRegistered(_token));
        tokens.push(_token);
        tokenMap[_token] = true;
        tokenSymbolMap[_symbol] = _token;
    }

    function unregisterToken(address _token, string _symbol)
        public
        onlyOwner
    {
        require(tokenSymbolMap[_symbol] == _token);
        delete tokenSymbolMap[_symbol];
        delete tokenMap[_token];
        for (uint i = 0; i < tokens.length; i++) {
            if (tokens[i] == _token) {
                tokens[i] = tokens[tokens.length - 1];
                tokens.length --;
                break;
            }
        }
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
        return tokenMap[_token];
    }

    function areAllTokensRegistered(address[] tokenList)
        public
        constant
        returns (bool)
    {
        for (uint i = 0; i < tokenList.length; i++) {
            if (!tokenMap[tokenList[i]]) {
                return false;
            }
        }
        return true;
    }

    function getAddressBySymbol(string symbol)
        public
        constant
        returns (address)
    {
        return tokenSymbolMap[symbol];
    }

}
