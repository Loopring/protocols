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

import "../iface/ILoopring.sol";

import "../lib/AddressUtil.sol";
import "../lib/BurnableERC20.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/Ownable.sol";

import "./DEX.sol";


/// @title An Implementation of ILoopring.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract Loopring is ILoopring, Ownable
{
    using AddressUtil for address;

    function updateSettings(
        address _lrcAddress,
        uint _dexCreationCostLRC,
        uint _dexCreationIncrementalCostLRC,
        uint _dexStakedLRCPerFailure
        )
        external
        onlyOwner
    {
        require(address(0) != _lrcAddress, "ZERO_ADDRESS");
        require(0 != _dexCreationCostLRC, "ZERO_VALUE");
        require(0 != _dexCreationIncrementalCostLRC, "ZERO_VALUE");
        require(0 != _dexStakedLRCPerFailure, "ZERO_VALUE");

        lrcAddress = _lrcAddress;
        dexCreationCostLRC = _dexCreationCostLRC;
        dexCreationIncrementalCostLRC = _dexCreationIncrementalCostLRC;
        dexStakedLRCPerFailure = _dexStakedLRCPerFailure;
    }

    function createExchange(
        address exchangeOwnerContractAddress,
        uint32  numFailuresAllowed)
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

        uint totalCostLRC = dexCreationCostLRC +
            exchanges.length * dexCreationIncrementalCostLRC;

        // Burn the LRC
        if (totalCostLRC > 0) {
            require(
                BurnableERC20(lrcAddress).burn(totalCostLRC),
                "BURN_FAILURE"
            );
        }

        exchangeId = exchanges.length + 1;

        IDEX exchange = new DEX(
            exchangeId,
            address(this),
            exchangeOwnerContractAddress,
            sender,
            lrcAddress,
            dexStakedLRCPerFailure,
            numFailuresAllowed
        );

        exchangeAddress = address(exchange);
        exchanges.push(exchangeAddress);

        emit ExchangeCreated(
            exchangeId,
            exchangeAddress,
            exchangeOwnerContractAddress,
            sender,
            totalCostLRC
        );
    }

}