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
import "./TokenRegistry.sol";


/// @title ERC20 Token Mint
/// @dev This contract deploys ERC20 token contract and registered the contract
///      so the token can be traded with Loopring Protocol.
/// @author Kongliang Zhong - <kongliang@loopring.org>,
/// @author Daniel Wang - <daniel@loopring.org>.
contract TokenFactory {
    using AddressUtil for address;
    using StringUtil for string;

    mapping(bytes10 => address) public tokens;
    address   public tokenRegistry;
    address   public tokenTransferDelegate;

    event TokenCreated(
        address indexed addr,
        string  name,
        string  symbol,
        uint8   decimals,
        uint    totalSupply,
        address firstHolder,
        address tokenTransferDelegate
    );

    /// @dev Disable default function.
    function () payable public
    {
        revert();
    }

    /// @dev Initialize TokenRegistry address.
    ///      This method sjhall be called immediately upon deployment.
    function initialize(
        address _tokenRegistry,
        address _tokenTransferDelegate
        )
        public
    {
        require(tokenRegistry == 0x0 && _tokenRegistry.isContract());
        tokenRegistry = _tokenRegistry;

        require(tokenTransferDelegate == 0x0 && _tokenTransferDelegate.isContract());
        tokenTransferDelegate = _tokenTransferDelegate;
    }

    /// @dev Deploy an ERC20 token contract, register it with TokenRegistry,
    ///      and returns the new token's address.
    /// @param name The name of the token
    /// @param symbol The symbol of the token.
    /// @param decimals The decimals of the token.
    /// @param totalSupply The total supply of the token.
    function createToken(
        string  name,
        string  symbol,
        uint8   decimals,
        uint    totalSupply
        )
        public
        returns (address addr)
    {
        require(tokenRegistry != 0x0);
        require(tokenTransferDelegate != 0x0);
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
        TokenRegistry(tokenRegistry).registerMintedToken(addr, symbol);
        tokens[symbolBytes] = addr;

        emit TokenCreated(
            addr,
            name,
            symbol,
            decimals,
            totalSupply,
            tx.origin,
            tokenTransferDelegate
        );
    }
}
