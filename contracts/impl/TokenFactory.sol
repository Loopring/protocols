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

import "../iface/ITokenFactory.sol";
import "../iface/ITokenRegistry.sol";
import "../lib/AddressUtil.sol";
import "../lib/ERC20Token.sol";
import "../lib/NoDefaultFunc.sol";
import "../lib/StringUtil.sol";


/// @title An Implementation of ITokenFactory.
/// @author Kongliang Zhong - <kongliang@loopring.org>,
/// @author Daniel Wang - <daniel@loopring.org>.
contract TokenFactoryImpl is ITokenFactory, NoDefaultFunc {
    using AddressUtil for address;
    using StringUtil for string;

    address   public tokenRegistry;

    constructor(
        address _tokenRegistry
        )
        public
    {
        require(tokenRegistry == 0x0 && _tokenRegistry.isContract());
        tokenRegistry = _tokenRegistry;
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
        require(symbol.checkStringLength(3, 10), "bad symbol size");

        ERC20Token token = new ERC20Token(
            name,
            symbol,
            decimals,
            totalSupply,
            tx.origin
        );

        addr = address(token);
        ITokenRegistry(tokenRegistry).registerToken(addr, symbol);

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
