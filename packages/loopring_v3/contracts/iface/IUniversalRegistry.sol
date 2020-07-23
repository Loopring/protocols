// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;

import "../lib/Claimable.sol";
import "../lib/ReentrancyGuard.sol";


/// @title IUniversalRegistry
/// @dev This contract manages all registered ILoopring versions and all Loopring
///      based exchanges.
///
/// @author Daniel Wang  - <daniel@loopring.org>
abstract contract IUniversalRegistry is Claimable, ReentrancyGuard
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
        bool            rollupMode,
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
        virtual
        returns (address implManager);

    /// @dev Sets the default protocol.
    /// @param protocol The new default protocol.
    function setDefaultProtocol(
        address protocol
        )
        external
        virtual;

    /// @dev Enables a protocol.
    /// @param protocol The address of the protocol.
    function enableProtocol(
        address protocol
        )
        external
        virtual;

    /// @dev Disables a protocol.
    /// @param protocol The address of the protocol.
    function disableProtocol(
        address protocol
        )
        external
        virtual;

    /// @dev Creates a new exchange using a specific protocol with msg.sender
    ///      as owner and operator.
    /// @param forgeMode The forge mode.
    /// @param rollupMode True to run in 100% zkRollup mode, false to run in Validium mode.
    /// @param protocol The protocol address, use 0x0 for default.
    /// @param implementation The implementation to use, use 0x0 for default.
    /// @return exchangeAddress The new exchange's address
    /// @return exchangeId The new exchange's ID.
    function forgeExchange(
        ForgeMode forgeMode,
        bool      rollupMode,
        address   protocol,
        address   implementation
        )
        external
        virtual
        returns (
            address exchangeAddress,
            uint    exchangeId
        );

    /// @dev Returns information regarding the default protocol.
    /// @return protocol The address of the default protocol.
    /// @return versionmanager The address of the version manager
    /// @return defaultImpl The address of the default protocol's implementation manager.
    /// @return protocolVersion The version of the default protocol.
    /// @return defaultImplVersion The version of the default implementation.
    function defaultProtocol()
        public
        virtual
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
        virtual
        view
        returns (bool registered);

    /// @dev Checks if a protocol has been enabled.
    /// @param protocol The address of the protocol.
    /// @return enabled True if the prococol is registered and enabled.
    function isProtocolEnabled(
        address protocol
        )
        public
        virtual
        view
        returns (bool enabled);

    /// @dev Checks if the addres is a registered Loopring exchange.
    /// @return registered True if the address is a registered exchange.
    function isExchangeRegistered(
        address exchange
        )
        public
        virtual
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
        virtual
        view
        returns (bool enabled);

    /// @dev Returns the protocol associated with an exchange.
    /// @param exchangeAddress The address of the exchange.
    /// @return protocol The protocol address.
    /// @return manager The protocol's implementation manager.
    function getExchangeProtocol(
        address exchangeAddress
        )
        public
        virtual
        view
        returns (
            address protocol,
            address manager
        );
}