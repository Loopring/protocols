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

import "../iface/ILoopringV3.sol";

import "../lib/AddressUtil.sol";
import "../lib/BurnableERC20.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/Ownable.sol";

import "./DEX.sol";


/// @title An Implementation of ILoopringV3.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract LoopringV3 is ILoopringV3, Ownable
{
    using AddressUtil for address;

    function updateSettings(
        address _lrcAddress,
        uint _creationCostLRC
        )
        external
        onlyOwner
    {
        require(address(0) != _lrcAddress, "ZERO_ADDRESS");
        require(0 != _creationCostLRC, "ZERO_VALUE");

        lrcAddress = _lrcAddress;
        creationCostLRC = _creationCostLRC;
    }

    function createExchange(
        address exchangeOwnerContractAddress
        )
        external
        returns (uint exchangeId, address exchangeAddress)
    {
        require(
            exchangeOwnerContractAddress.isContract(),
            "OWNER_NOT_CONTRACT"
        );

        address sender = msg.sender;
        require(
            sender.isContract(),
            "CREATOR_IS_CONTRACT"
        );

        // Burn the LRC
        if (creationCostLRC > 0) {
            require(
                BurnableERC20(lrcAddress).burn(creationCostLRC),
                "BURN_FAILURE"
            );
        }

        exchangeId = exchanges.length + 1;

        IDEX exchange = new DEX(
            exchangeId,
            address(this),
            exchangeOwnerContractAddress,
            sender
        );

        exchangeAddress = address(exchange);
        exchanges.push(exchangeAddress);

        emit ExchangeCreated(
            exchangeId,
            exchangeAddress,
            exchangeOwnerContractAddress,
            sender,
            creationCostLRC
        );
    }

}