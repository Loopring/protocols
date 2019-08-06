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
pragma solidity 0.5.10;


/// @title IProtocalRegistry
/// @author Daniel Wang  - <daniel@loopring.org>
contract IProtocolRegistry
{
    address public defaultProtocol;

    event ExchangeForged (
        address loopring,
        address exchangeAddress,
        address owner,
        uint    exchangeId
    );

    /// @dev Returns information regarding the default protocol.
    /// @return loopring The default protocol address.
    /// @return instance The protocol's default instance.
    /// @return version The protocol's version number.
    function getDefaultProtocol()
        external
        view
        returns (
            address protocol,
            address instance,
            string  memory version
        );

    function setDefaultProtocol(
        address protocol
        )
        external;

    /// @dev Returns information regarding a protocol.
    /// @return protocol The protocol address.
    /// @return instance The protocol's default instance.
    /// @return version The protocol's version number.
    function getProtocol(
        address protocol
        )
        public
        view
        returns (
            address instance,
            string memory version
        );

    /// @dev Returns the protocol assgined to msg.sender.
    /// @return protocol The protocol address.
    /// @return instance The protocol's default instance.
    /// @return version The protocol's version number.
    function getProtocol()
        external
        view
        returns (
            address protocol,
            address instance,
            string  memory version
        );

    /// @dev Register a new protocol
    /// @param protocol The protocol address.
    /// @param version The protocol's version number.
    function registerProtocol(
        address protocol,
        string  memory version
        )
        public;

    /// @dev Create a new exchange using the default protocol with msg.sender
    ///      as owner and operator.
    /// @param supportUpgradability True to indicate an ExchangeProxy shall be deploy
    ///        in front of the native exchange contract to support upgradability.
    /// @param onchainDataAvailability If the on-chain DA is on
    /// @return exchangeAddress The new exchange's  address.
    /// @return exchangeId The new exchange's ID.
    function forgeExchange(
        bool supportUpgradability,
        bool onchainDataAvailability
        )
        external
        returns (
            address exchangeAddress,
            uint    exchangeId
        )
    {
        return forgeExchange(
            msg.sender,
            msg.sender,
            defaultProtocol,
            supportUpgradability,
            onchainDataAvailability
        );
    }

    /// @dev Create a new exchange using a specific protocol with msg.sender
    ///      as owner and operator.
    /// @param owner The owner of the exchange.
    /// @param operator The operator of the exchange.
    /// @param protocol The protocol address.
    /// @param supportUpgradability True to indicate an ExchangeProxy shall be deploy
    ///        in front of the native exchange contract to support upgradability.
    /// @param onchainDataAvailability IF the on-chain DA is on
    /// @return exchangeAddress The new exchange's address.
    /// @return exchangeId The new exchange's ID.
    function forgeExchange(
        address owner,
        address payable operator,
        address protocol,
        bool    supportUpgradability,
        bool    onchainDataAvailability
        )
        public
        returns (
            address exchangeAddress,
            uint    exchangeId
        );
}
