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
pragma solidity 0.4.21;

import "./lib/AddressUtil.sol";
import "./lib/StringUtil.sol";
import "./lib/ERC20Token.sol";
import "./TokenFactory.sol";


/// @title An Implementation of TokenFactory.
/// @author Kongliang Zhong - <kongliang@loopring.org>,
/// @author Daniel Wang - <daniel@loopring.org>.
contract TokenFactoryImpl is TokenFactory {
    using AddressUtil for address;
    using StringUtil for string;

    mapping(bytes10 => address) public tokens;

    /// @dev Disable default function.
    function ()
        payable
        public
    {
        revert();
    }

    function createToken(
        string  name,
        string  symbol,
        uint8   decimals,
        uint    totalSupply
        )
        external
        returns (address addr)
    {
        require(symbol.checkStringLength(3, 10));

        bytes10 symbolBytes = symbol.stringToBytes10();
        require(tokens[symbolBytes] == 0x0);

        ERC20Token token = new ERC20Token(
            name,
            symbol,
            decimals,
            totalSupply,
            tx.origin
        );

        addr = address(token);
        tokens[symbolBytes] = addr;

        emit TokenCreated(
            addr,
            name,
            symbol,
            decimals,
            totalSupply,
            tx.origin
        );
    }
}
