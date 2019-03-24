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

import "../lib/BurnableERC20.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";
import "../lib/Ownable.sol";

import "./DEX.sol";


/// @title An Implementation of ILoopringV3.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract LoopringV3 is ILoopringV3, Ownable
{
    using MathUint          for uint;
    using ERC20SafeTransfer for address;


    // == Public Functions ==

    function updateSettings(
        address _lrcAddress,
        address _wethAddress,
        uint    _exchangeCreationCostLRC,
        uint16  _tierUpgradeCostBips
        )
        external
        onlyOwner
    {
        require(address(0) != _lrcAddress, "ZERO_ADDRESS");
        require(address(0) != _wethAddress, "ZERO_ADDRESS");
        require(0 != _exchangeCreationCostLRC, "ZERO_VALUE");
        require(10 >= _tierUpgradeCostBips, "VALUE_TOO_LARGE");

        delete tokens[lrcAddress];
        delete tokens[wethAddress];

        lrcAddress = _lrcAddress;
        wethAddress = _wethAddress;
        exchangeCreationCostLRC = _exchangeCreationCostLRC;
        tierUpgradeCostBips = _tierUpgradeCostBips;

        tokens[lrcAddress]  = Token(lrcAddress, 1, 0xFFFFFFFF);
        tokens[wethAddress] = Token(wethAddress, 3, 0xFFFFFFFF);

        emit SettingsUpdated(now);
    }

    function createExchange(
        address _committer
        )
        external
        returns (
            uint exchangeId,
            address exchangeAddress
        )
    {
        // Burn the LRC
        if (exchangeCreationCostLRC > 0) {
            require(
                BurnableERC20(lrcAddress).burn(exchangeCreationCostLRC),
                "BURN_FAILURE"
            );
        }

        exchangeId = exchanges.length + 1;

        address committer;
        if (address(0) == _committer) {
            committer = msg.sender;
        } else {
            committer = _committer;
        }

        IDEX exchange = new DEX(
            exchangeId,
            address(this),
            msg.sender,
            committer
        );

        exchangeAddress = address(exchange);
        exchanges.push(exchangeAddress);

        emit ExchangeCreated(
            exchangeId,
            exchangeAddress,
            msg.sender,
            committer,
            exchangeCreationCostLRC
        );
    }


    function getStake(
        uint exchangeId
        )
        public
        view
        returns (uint)
    {
        require(
            exchangeId > 0 && exchangeId <= exchanges.length,
            "INVALID_EXCHANGE_ID"
        );
        return exchangeStakes[exchangeId - 1];
    }

    function burnStake(
        uint exchangeId
        )
        external
        returns (uint stakedLRC)
    {
        address exchangeAddress = getExchangeAddress(exchangeId);
        require(msg.sender == exchangeAddress, "UNAUTHORIZED");

        stakedLRC = getStake(exchangeId);
        if (stakedLRC > 0) {
            require(
                BurnableERC20(lrcAddress).burn(stakedLRC),
                "BURN_FAILURE"
            );
            delete exchangeStakes[exchangeId];
            totalStake -= stakedLRC;

            emit StakeBurned(exchangeId, stakedLRC);
        }
    }

    function depositStake(
        uint exchangeId,
        uint amountLRC
        )
        external
        returns (uint stakedLRC)
    {
        require(amountLRC > 0, "ZERO_VALUE");
        require(
            lrcAddress.safeTransferFrom(
                msg.sender,
                address(this),
                amountLRC
            ),
            "TRANSFER_FAILURE"
        );
        stakedLRC = exchangeStakes[exchangeId] + amountLRC;
        exchangeStakes[exchangeId] = stakedLRC;
        totalStake += stakedLRC;
        emit StakeDeposited(exchangeId, stakedLRC);
    }


    function withdrawStake(
        uint exchangeId
        )
        external
        returns (uint stakedLRC)
    {
        address exchangeAddress = getExchangeAddress(exchangeId);
        require(msg.sender == exchangeAddress, "UNAUTHORIZED");

        stakedLRC = getStake(exchangeId);
        if (stakedLRC > 0) {
            require(
                lrcAddress.safeTransferFrom(
                    address(this),
                    msg.sender,
                    stakedLRC
                ),
                "WITHDRAWAL_FAILURE"
            );
            delete exchangeStakes[exchangeId];
            totalStake -= stakedLRC;

            emit StakeWithdrawn(exchangeId, stakedLRC);
        }
    }

    function getTokenBurnRate(
        address _token
        )
        public
        view
        returns (uint16 burnRate)
    {
        Token storage token = tokens[_token];
        if (token.tierValidUntil < now) {
            burnRate = BURNRATE_TIER4;
        } else if (token.tier == 1) {
            burnRate = BURNRATE_TIER1;
        } else if (token.tier == 2) {
            burnRate = BURNRATE_TIER2;
        } else if (token.tier == 3) {
            burnRate = BURNRATE_TIER3;
        } else {
            burnRate = BURNRATE_TIER4;
        }
    }

    // == Internal Functions ==

    function getExchangeAddress(
        uint exchangeId
        )
        internal
        view
        returns (address)
    {
        require(
            exchangeId > 0 && exchangeId <= exchanges.length,
            "INVALID_EXCHANGE_ID"
        );
        return exchanges[exchangeId - 1];
    }

    function buydownTokenBurnRate(
        address _token
        )
        external
    {
        require(_token != address(0), "ZERO_ADDRESS");
        require(_token != lrcAddress, "BURN_RATE_FROZEN");
        require(_token != wethAddress, "BURN_RATE_FROZEN");

        Token storage token = tokens[_token];

        uint8 currentTier = 4;
        if (token.tier != 0) currentTier = token.tier;

        // Can't upgrade to a higher level than tier 1
        require(currentTier > 1, "BURN_RATE_MINIMIZED");

        // Burn tierUpgradeCostBips of total LRC supply
        BurnableERC20 LRC = BurnableERC20(lrcAddress);
        uint totalSupply = LRC.totalSupply();
        uint amount = totalSupply.mul(tierUpgradeCostBips) / 10000;
        bool success = LRC.burnFrom(msg.sender, amount);
        require(success, "BURN_FAILURE");

        // Upgrade tier
        token.tokenAddress = _token;
        token.tier = currentTier - 1;

        if (token.tierValidUntil < now) {
            token.tierValidUntil = now + TIER_UPGRADE_DURATION;
        } else {
            token.tierValidUntil += TIER_UPGRADE_DURATION;
        }

        emit TokenBurnRateDown(_token, token.tier);
    }

}