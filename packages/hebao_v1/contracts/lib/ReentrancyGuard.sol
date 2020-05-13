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
pragma solidity ^0.6.6;


/// @title ReentrancyGuard
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev Exposes a modifier that guards a function against reentrancy
///      Changing the value of the same storage value multiple times in a transaction
///      is cheap (starting from Istanbul) so there is no need to minimize
///      the number of times the value is changed
contract ReentrancyGuard
{
    //The default value must be 0 in order to work behind a proxy.
    bytes4[] private _callstack;
    bytes4 public constant INTERNAL_FUNCTION = bytes4(0);

    modifier nonReentrant()
    {
        string memory error = fromCode(msg.sig);
        require(_callstack.length == 0, error);
        _callstack.push(msg.sig);
        _;
        _callstack.pop();
    }

    modifier nonReentrantInternal()
    {
        require(_callstack.length == 0, "REENTRANCY");
        _callstack.push(INTERNAL_FUNCTION);
        _;
        _callstack.pop();
    }

    modifier reentrantWhitelist(bytes4 selectorWhitelist)
    {
        require(
            _callstack.length == 0 || isLastSelectorIn(selectorWhitelist),
            "WHITELISTE_REENTRANCY"
        );

        _callstack.push(msg.sig);
        _;
        _callstack.pop();
    }


    modifier reentrantBlacklist(bytes4 selectorBlacklist)
    {
        require(
            _callstack.length == 0 || !isLastSelectorIn(selectorBlacklist),
            "BLACKLISTE_REENTRANCY"
        );

        _callstack.push(msg.sig);
        _;
        _callstack.pop();
    }

    function isLastSelectorIn(bytes4 list)
        private
        returns (bool)
    {
        bytes4 lastSelector =_callstack[_callstack.length - 1] ;
        return lastSelector & list == lastSelector;
    }

function toHexDigit(uint8 d) pure internal returns (byte) {                                                                                      
    if (0 <= d && d <= 9) {                                                                                                                      
        return byte(uint8(byte('0')) + d);                                                                                                       
    } else if (10 <= uint8(d) && uint8(d) <= 15) {                                                                                               
        return byte(uint8(byte('a')) + d - 10);                                                                                                  
    }                                                                                                                                            
    revert();                                                                                                                                    
} 

function fromCode(bytes4 code) public pure returns (string memory) {                                                                                    
    bytes memory result = new bytes(10);                                                                                                         
    result[0] = byte('0');
    result[1] = byte('x');
    for (uint i=0; i<4; ++i) {
        result[2*i+2] = toHexDigit(uint8(code[i])/16);
        result[2*i+3] = toHexDigit(uint8(code[i])%16);
    }
    return string(result);
}

}
