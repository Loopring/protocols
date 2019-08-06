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
    event ExchangeCreated (
        address loopring,
        address exchangeProxy,
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
    /// @param instance The protocol's default instance.
    /// @param version The protocol's version number.
    function registerProtocol(
        address protocol,
        address instance,
        string  memory version
        )
        public;


    /// @dev Create a new exchange using the default protocol with msg.sender
    ///      as owner and operator.
    /// @param onchainDataAvailability If the on-chain DA is on
    /// @return exchangeProxy The new exchange's proxy address.
    /// @return exchangeId The new exchange's ID.
    function createExchange(
        bool onchainDataAvailability
        )
        external
        returns (
            address exchangeProxy,
            uint    exchangeId
        );

    /// @dev Create a new exchange using a specific protocol with msg.sender
    ///      as owner and operator.
    /// @param protocol The protocol's address.
    /// @param onchainDataAvailability IF the on-chain DA is on
    /// @return exchangeProxy The new exchange's proxy address.
    /// @return exchangeId The new exchange's ID.
    function createExchange(
        address protocol,
        address payable operator,
        bool    onchainDataAvailability
        )
        public
        returns (
            address exchangeProxy,
            uint    exchangeId
        );
}
