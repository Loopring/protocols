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
pragma solidity ^0.5.11;

import "../lib/Claimable.sol";
import "../lib/ReentrancyGuard.sol";


/// @title IProtocalRegistry
/// @author Daniel Wang  - <daniel@loopring.org>
contract IProtocolRegistry is Claimable, ReentrancyGuard
{
    address     public lrcAddress;
    address     public defaultProtocol;
    address[]   public exchanges;

    event ExchangeForged (
        address indexed loopring,
        address indexed exchangeAddress,
        address         owner,
        bool            supportUpgradability,
        bool            onchainDataAvailability,
        uint            exchangeId,
        uint            amountLRCBurned
    );

    event ProtocolRegistered (
        address indexed protocol,
        address indexed implementation
    );

    event ProtocolUpgraded (
        address indexed protocol,
        address indexed newImplementation,
        address         oldImplementation
    );

    event DefaultProtocolChanged(
        address indexed newDefault,
        address         oldDefault
    );

    event ProtocolDisabled(
        address indexed protocol
    );

    event ProtocolEnabled(
        address indexed protocol
    );

    /// @dev Returns true if the given address is a registered Loopring DEX.
    function isRegisteredExchange(
        address addr
        )
        external
        returns (bool);

    /// @dev Registers a new protocol
    /// @param protocol The protocol address.
    /// @param implementation The protocol's implementaion address.
    /// @return implementation The Protocol's implementation.
    function registerProtocol(
        address protocol,
        address implementation
        )
        external;

    /// @dev Updates a protocol with a new implementation
    /// @param protocol The protocol address.
    /// @param newImplementation The protocol's new implementation.
    /// @return oldImplementation The Protocol's previous implementation.
    function upgradeProtocol(
        address protocol,
        address newImplementation
        )
        external
        returns (address oldImplementation);

    /// @dev Disables a protocol.
    /// @param protocol The protocol to disable.
    function disableProtocol(
        address protocol
        )
        external;

    /// @dev Enables a protocol.
    /// @param protocol The protocol to re-enable.
    function enableProtocol(
        address protocol
        )
        external;

    /// @dev Sets the default protocol.
    /// @param protocol The address of the default protocol version.
    function setDefaultProtocol(
        address protocol
        )
        external;

    /// @dev Returns information regarding the default protocol.
    ///      This function throws if no default protocol is set.
    /// @return loopring The default protocol address.
    /// @return implementation The protocol's implementation.
    /// @return enabled Whether the protocol is enabled.
    function getDefaultProtocol()
        external
        view
        returns (
            address protocol,
            address implementation,
            bool    enabled
        );

    /// @dev Returns information regarding a protocol.
    /// @return protocol The protocol address.
    /// @return implementation The protocol's implementation.
    /// @return enabled Whether the protocol is enabled.
    function getProtocol(
        address protocol
        )
        external
        view
        returns (
            address implementation,
            bool    enabled
        );

    /// @dev Returns the protocol associated with an exchange.
    /// @param exchangeAddress The address of the exchange.
    /// @return protocol The protocol address.
    /// @return implementation The protocol's implementation.
    /// @return enabled Whether the protocol is enabled.
    function getExchangeProtocol(
        address exchangeAddress
        )
        external
        view
        returns (
            address protocol,
            address implementation,
            bool    enabled
        );

    /// @dev Create a new exchange using the default protocol with msg.sender
    ///      as owner and operator.
    /// @param supportUpgradability True to indicate an ExchangeUpgradabilityProxy
    ///        shall be deploy in front of the native exchange contract to support
    ///        upgradability; false to indicate a ExchangeSimpleProxy should be
    ///        deployed instead.
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
        );

    /// @dev Create a new exchange using a specific protocol with msg.sender
    ///      as owner and operator.
    /// @param protocol The protocol address.
    /// @param supportUpgradability True to indicate an ExchangeUpgradabilityProxy
    ///        shall be deploy in front of the native exchange contract to support
    ///        upgradability; false to indicate a ExchangeSimpleProxy should be
    ///        deployed instead.
    /// @param onchainDataAvailability IF the on-chain DA is on
    /// @return exchangeAddress The new exchange's address.
    /// @return exchangeId The new exchange's ID.
    function forgeExchange(
        address protocol,
        bool    supportUpgradability,
        bool    onchainDataAvailability
        )
        external
        returns (
            address exchangeAddress,
            uint    exchangeId
        );
}
