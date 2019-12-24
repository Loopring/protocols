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


/// @title IUniversalRegistry
/// @dev This contract manages all registered ILoopring versions and all Loopring
///      based exchanges.
///
/// @author Daniel Wang  - <daniel@loopring.org>
contract IUniversalRegistry is Claimable, ReentrancyGuard
{
    enum ForgeMode {
        AUTO_UPGRADABLE,
        MANUAL_UPGRADABLE,
        PROXIED,
        NATIVE
    }

    /// === Events ===

    event ProtocolRegistered (
        address indexed protocol,
        address indexed implementationManager,
        string          version
    );

    event ProtocolEnabled (
        address indexed protocol
    );

    event ProtocolDisabled (
        address indexed protocol
    );

    event DefaultProtocolChanged (
        address indexed oldDefault,
        address indexed newDefault
    );

    event ExchangeForged (
        address indexed protocol,
        address indexed implementation,
        address indexed exchangeAddress,
        address         owner,
        ForgeMode       forgeMode,
        bool            onchainDataAvailability,
        uint            exchangeId,
        uint            amountLRCBurned
    );

    /// === Data ===

    address   public lrcAddress;
    address[] public exchanges;
    address[] public protocols;

    // IProtocol.version => IProtocol address
    mapping (string => address) public versionMap;

    /// === Functions ===

    /// @dev Registers a new protocol.
    /// @param protocol The address of the new protocol.
    /// @param implementation The new protocol's default implementation.
    /// @return implManager A new implementation manager to manage the protocol's implementations.
    function registerProtocol(
        address protocol,
        address implementation
        )
        external
        returns (address implManager);

    /// @dev Sets the default protocol.
    /// @param protocol The new default protocol.
    function setDefaultProtocol(
        address protocol
        )
        external;

    /// @dev Enables a protocol.
    /// @param protocol The address of the protocol.
    function enableProtocol(
        address protocol
        )
        external;

    /// @dev Disables a protocol.
    /// @param protocol The address of the protocol.
    function disableProtocol(
        address protocol
        )
        external;

    /// @dev Creates a new exchange using a specific protocol with msg.sender
    ///      as owner and operator.
    /// @param forgeMode The forge mode.
    /// @param onchainDataAvailability IF the on-chain DA is on
    /// @param protocol The protocol address, use 0x0 for default.
    /// @param implementation The implementation to use, use 0x0 for default.
    /// @return exchangeAddress The new exchange's address
    /// @return exchangeId The new exchange's ID.
    function forgeExchange(
        ForgeMode forgeMode,
        bool      onchainDataAvailability,
        address   protocol,
        address   implementation
        )
        external
        returns (
            address exchangeAddress,
            uint    exchangeId
        );

    /// @dev Returns information regarding the default protocol.
    /// @return protocol The address of the default protocol.
    /// @return implManager The address of the default protocol's implementation manager.
    /// @return defaultImpl The default protocol's default implementation address.
    /// @return defaultImplVersion The version of the default implementation.
    function defaultProtocol()
        public
        view
        returns (
            address protocol,
            address versionmanager,
            address defaultImpl,
            string  memory protocolVersion,
            string  memory defaultImplVersion
        );

    /// @dev Checks if a protocol has been registered.
    /// @param protocol The address of the protocol.
    /// @return registered True if the prococol is registered.
    function isProtocolRegistered(
        address protocol
        )
        public
        view
        returns (bool registered);

    /// @dev Checks if a protocol has been enabled.
    /// @param protocol The address of the protocol.
    /// @return enabled True if the prococol is registered and enabled.
    function isProtocolEnabled(
        address protocol
        )
        public
        view
        returns (bool enabled);

    /// @dev Checks if the addres is a registered Loopring exchange.
    /// @return registered True if the address is a registered exchange.
    function isExchangeRegistered(
        address exchange
        )
        public
        view
        returns (bool registered);

    /// @dev Checks if the given protocol and implementation are both registered and enabled.
    /// @param protocol The address of the protocol.
    /// @param implementation The address of the implementation.
    /// @return enabled True if both the protocol and the implementation are registered and enabled.
    function isProtocolAndImplementationEnabled(
        address protocol,
        address implementation
        )
        public
        view
        returns (bool enabled);

    /// @dev Returns the protocol associated with an exchange.
    /// @param exchangeAddress The address of the exchange.
    /// @return protocol The protocol address.
    /// @return implementationManager The protocol's implementation manager.
    /// @return enabled Whether the protocol is enabled.
    function getExchangeProtocol(
        address exchangeAddress
        )
        public
        view
        returns (
            address protocol,
            address implementationManager
        );
}