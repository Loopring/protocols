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
pragma solidity 0.5.2;

import "./Exchange.sol";


/// @title An Implementation of IExchangeDeployer.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
/// @dev We created this library to work around the gas limit -- inlining the
///      enclosed function directly into LoopringV3 will make LoopringV3 too large
///      to deploy.
library ExchangeDeployer
{
    function deployExchange(
        uint    exchangeId,
        address loopringAddress,
        address owner,
        address payable operator,
        bool    onchainDataAvailability
        )
        external
        returns (address)
    {
        Exchange exchange = new Exchange(
            exchangeId,
            loopringAddress,
            owner,
            operator,
            onchainDataAvailability
        );
        return address(exchange);
    }
}
