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

import "./lib/Claimable.sol";


/// @title Token Register Contract
/// @dev This contract maintains a list of tokens the Protocol supports.
/// @author Kongliang Zhong - <kongliang@loopring.org>,
/// @author Daniel Wang - <daniel@loopring.org>.
contract TokenRegistry is Claimable {

    address[] public tokens;

    mapping (address => TokenInfo) tokenMap;

    mapping (string => address) tokenSymbolMap;
    
    
    uint8 public constant TOKEN_STANDARD_ERC20   = 0;
    uint8 public constant TOKEN_STANDARD_ERC223  = 1;
    
    struct TokenInfo {
        uint index;             // Index + 1 of the address in the tokens array, 0 means unregistered.
        uint8 tokenStandard;    // ERC20 or ERC223
        string symbol;          // Symbol of the token
    }
    

    // TODO: need to add token standard
    function registerToken(address _addr, string _symbol)
        external
        onlyOwner
    {
        require(_addr != 0x0);
        require(bytes(_symbol).length > 0);
        require(!isTokenRegisteredBySymbol(_symbol));
        require(!isTokenRegistered(_addr));
        tokens.push(_addr);
        tokenMap[_addr] = TokenInfo(tokens.length, TOKEN_STANDARD_ERC20, _symbol);
        tokenSymbolMap[_symbol] = _addr;
    }

    function unregisterToken(address _token, string _symbol)
        external
        onlyOwner
    {
        require(_token != 0x0);
        require(tokenSymbolMap[_symbol] == _token);
        delete tokenSymbolMap[_symbol];
        
        uint index = tokenMap[_token].index;
        require(index != 0);
        delete tokenMap[_token];
        
        // We will replace the token we need to unregister with the last token
        // Only the index of the last token will need to be updated
        address lastToken = tokens[tokens.length - 1];
        
        // Don't do anything if the last token is the one we want to delete
        if (_token != lastToken) {
            // Swap with the last token and update the index
            tokens[index - 1] = lastToken;
            tokenMap[lastToken].index = index;
        }
        tokens.length--;
    }

    function isTokenRegisteredBySymbol(string symbol)
        public
        view
        returns (bool)
    {
        return tokenSymbolMap[symbol] != 0x0;
    }

    function isTokenRegistered(address _token)
        public
        view
        returns (bool)
    {
        return tokenMap[_token].index != 0;
    }

    function areAllTokensRegistered(address[] tokenList)
        external
        view
        returns (bool)
    {
        for (uint i = 0; i < tokenList.length; i++) {
            if (tokenMap[tokenList[i]].index == 0) {
                return false;
            }
        }
        return true;
    }
    
    function getTokenStandard(address _token)
        public
        view
        returns (uint8)
    {
        var info = tokenMap[_token];
        require(info.index != 0);
        return info.tokenStandard;
    }

    function getAddressBySymbol(string symbol)
        external
        view
        returns (address)
    {
        return tokenSymbolMap[symbol];
    }
    
    function getTokens(uint startIdx, uint count)
        public
        view
        returns (address[] tokensSubList)
    {
        uint numTokens = tokens.length;
        
        if (startIdx >= numTokens) {
            return;
        }
        
        uint endIdx = startIdx + count;
        if (endIdx > numTokens) {
            endIdx = numTokens;
        }

        if (startIdx == endIdx) {
            return;
        }
        
        tokensSubList = new address[](endIdx - startIdx);
        for (uint i = startIdx; i < endIdx; i++) {
            tokensSubList[i - startIdx] = tokens[i];
        }
    }
}
