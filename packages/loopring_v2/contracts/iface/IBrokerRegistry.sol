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
pragma solidity 0.5.7;


/// @title IBrokerRegistry
/// @dev A broker is an account that can submit orders on behalf of other
///      accounts. When registering a broker, the owner can also specify a
///      pre-deployed BrokerInterceptor to hook into the exchange smart contracts.
/// @author Daniel Wang - <daniel@loopring.org>.
contract IBrokerRegistry {
    event BrokerRegistered(
        address owner,
        address broker,
        address interceptor
    );

    event BrokerUnregistered(
        address owner,
        address broker,
        address interceptor
    );

    event AllBrokersUnregistered(
        address owner
    );

    /// @dev   Validates if the broker was registered for the order owner and
    ///        returns the possible BrokerInterceptor to be used.
    /// @param owner The owner of the order
    /// @param broker The broker of the order
    /// @return True if the broker was registered for the owner
    ///         and the BrokerInterceptor to use.
    function getBroker(
        address owner,
        address broker
        )
        external
        view
        returns(
            bool registered,
            address interceptor
        );

    /// @dev   Gets all registered brokers for an owner.
    /// @param owner The owner
    /// @param start The start index of the list of brokers
    /// @param count The number of brokers to return
    /// @return The list of requested brokers and corresponding BrokerInterceptors
    function getBrokers(
        address owner,
        uint    start,
        uint    count
        )
        external
        view
        returns (
            address[] memory brokers,
            address[] memory interceptors
        );

    /// @dev   Registers a broker for msg.sender and an optional
    ///        corresponding BrokerInterceptor.
    /// @param broker The broker to register
    /// @param interceptor The optional BrokerInterceptor to use (0x0 allowed)
    function registerBroker(
        address broker,
        address interceptor
        )
        external;

    /// @dev   Unregisters a broker for msg.sender
    /// @param broker The broker to unregister
    function unregisterBroker(
        address broker
        )
        external;

    /// @dev   Unregisters all brokers for msg.sender
    function unregisterAllBrokers(
        )
        external;
}
