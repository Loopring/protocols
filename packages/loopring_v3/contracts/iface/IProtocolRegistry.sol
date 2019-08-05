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

    // function getDefaultProtocol()
    //     external
    //     view
    //     returns (
    //         address loopring,
    //         address instance,
    //         string  version
    //     );

    // function setDefaultProtocol(address protocol)
    //     external;

    function getProtocol(
        address loopring
        )
        public
        view
        returns (
            address instance,
            string memory version
        );

    function registerProtocol(
        address loopring,
        address instance,
        string  memory version
        )
        public;

    function createExchange(
        address loopring,
        address payable _operator,
        bool    onchainDataAvailability
        )
        external
        returns (
            address exchangeProxy,
            uint    exchangeId
        );
}
