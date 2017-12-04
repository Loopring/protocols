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

    address[] public addresses;
    mapping (address => TokenInfo) addressMap;
    mapping (string => address) symbolMap;
    
    uint8 public constant TOKEN_STANDARD_ERC20   = 0;
    uint8 public constant TOKEN_STANDARD_ERC223  = 1;
    
    ////////////////////////////////////////////////////////////////////////////
    /// Structs                                                              ///
    ////////////////////////////////////////////////////////////////////////////

    struct TokenInfo {
        uint   pos;      // 0 mens unregistered; if > 0, pos + 1 is the
                         // token's position in `addresses`.
        uint8  standard; // ERC20 or ERC223
        string symbol;   // Symbol of the token
    }
    
    ////////////////////////////////////////////////////////////////////////////
    /// Events                                                               ///
    ////////////////////////////////////////////////////////////////////////////

    event TokenRegistered(address addr, string symbol);
    event TokenUnregistered(address addr, string symbol);
    
    ////////////////////////////////////////////////////////////////////////////
    /// Public Functions                                                     ///
    ////////////////////////////////////////////////////////////////////////////

    /// @dev Disable default function.
    function () payable public {
        revert();
    }

    function registerToken(
        address addr,
        string  symbol
        )
        external
        onlyOwner
    {
        registerStandardToken(addr, symbol, TOKEN_STANDARD_ERC20);    
    }

    function registerStandardToken(
        address addr,
        string  symbol,
        uint8   standard
        )
        public
        onlyOwner
    {
        require(0x0 != addr);
        require(bytes(symbol).length > 0);
        require(0x0 == symbolMap[symbol]);
        require(0 == addressMap[addr].pos);
        require(standard <= TOKEN_STANDARD_ERC223);

        addresses.push(addr);
        symbolMap[symbol] = addr;
        addressMap[addr] = TokenInfo(addresses.length, standard, symbol);

        TokenRegistered(addr, symbol);      
    }

    function unregisterToken(
        address addr,
        string  symbol
        )
        external
        onlyOwner
    {
        require(addr != 0x0);
        require(symbolMap[symbol] == addr);
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

        TokenUnregistered(addr, symbol);
    }

    function isTokenRegisteredBySymbol(string symbol)
        public
        view
        returns (bool)
    {
        return symbolMap[symbol] != 0x0;
    }

    function isTokenRegistered(address addr)
        public
        view
        returns (bool)
    {
        return addressMap[addr].pos != 0;
    }

    function areAllTokensRegistered(address[] addressList)
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
    
    function getTokenStandard(address addr)
        public
        view
        returns (uint8)
    {
        TokenInfo memory info = addressMap[addr];
        require(info.pos != 0);
        return info.standard;
    }

    function getAddressBySymbol(string symbol)
        external
        view
        returns (address)
    {
        return symbolMap[symbol];
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
}
