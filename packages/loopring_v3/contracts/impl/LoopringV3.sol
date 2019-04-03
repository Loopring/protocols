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

import "./ExchangeDeployer.sol";


/// @title An Implementation of ILoopring.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract LoopringV3 is ILoopringV3, Ownable
{
    using MathUint          for uint;
    using ERC20SafeTransfer for address;

    // -- Constructor --
    constructor(
        address _lrcAddress,
        address _wethAddress,
        address _blockVerifierAddress,
        uint    _exchangeCreationCostLRC,
        uint16  _tierUpgradeCostBips,
        uint    _maxWithdrawalFee,
        uint    _downtimePriceLRCPerDay,
        uint    _withdrawalFineLRC,
        uint    _tokenRegistrationFeeLRCBase,
        uint    _tokenRegistrationFeeLRCDelta
        )
        public
    {
        require(address(0) != _lrcAddress, "ZERO_ADDRESS");
        require(address(0) != _wethAddress, "ZERO_ADDRESS");

        lrcAddress = _lrcAddress;
        wethAddress = _wethAddress;

        tokens[lrcAddress] = Token(lrcAddress, 1, 0xFFFFFFFF);
        tokens[wethAddress] = Token(wethAddress, 3, 0xFFFFFFFF);
        tokens[address(0)] = Token(address(0), 3, 0xFFFFFFFF);

        updateSettings(
            _blockVerifierAddress,
            _exchangeCreationCostLRC,
            _tierUpgradeCostBips,
            _maxWithdrawalFee,
            _downtimePriceLRCPerDay,
            _withdrawalFineLRC,
            _tokenRegistrationFeeLRCBase,
            _tokenRegistrationFeeLRCDelta
        );
    }

    // == Public Functions ==
    function updateSettings(
        address _blockVerifierAddress,
        uint    _exchangeCreationCostLRC,
        uint16  _tierUpgradeCostBips,
        uint    _maxWithdrawalFee,
        uint    _downtimePriceLRCPerDay,
        uint    _withdrawalFineLRC,
        uint    _tokenRegistrationFeeLRCBase,
        uint    _tokenRegistrationFeeLRCDelta
        )
        public
        onlyOwner
    {
        require(address(0) != _blockVerifierAddress, "ZERO_ADDRESS");
        require(0 != _exchangeCreationCostLRC, "ZERO_VALUE");
        require(10 >= _tierUpgradeCostBips, "VALUE_TOO_LARGE");

        blockVerifierAddress = _blockVerifierAddress;
        exchangeCreationCostLRC = _exchangeCreationCostLRC;
        tierUpgradeCostBips = _tierUpgradeCostBips;
        maxWithdrawalFee = _maxWithdrawalFee;
        downtimePriceLRCPerDay = _downtimePriceLRCPerDay;
        withdrawalFineLRC = _withdrawalFineLRC;
        tokenRegistrationFeeLRCBase = _tokenRegistrationFeeLRCBase;
        tokenRegistrationFeeLRCDelta = _tokenRegistrationFeeLRCDelta;

        emit SettingsUpdated(now);
    }

    function createExchange(
        address payable _operator,
        bool onchainDataAvailability
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
                BurnableERC20(lrcAddress).burnFrom(msg.sender, exchangeCreationCostLRC),
                "BURN_FAILURE"
            );
        }

        exchangeId = exchanges.length + 1;

        address payable operator;
        if (address(0) == _operator) {
            operator = msg.sender;
        } else {
            operator = _operator;
        }

        exchangeAddress = ExchangeDeployer.deployExchange(
            exchangeId,
            address(this),
            msg.sender,
            operator,
            onchainDataAvailability
        );
        exchanges.push(exchangeAddress);

        emit ExchangeCreated(
            exchangeId,
            exchangeAddress,
            msg.sender,
            operator,
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

    function burnAllStake(
        uint exchangeId
        )
        external
        returns (uint burnedLRC)
    {
        burnedLRC = getStake(exchangeId);
        burnStake(exchangeId, burnedLRC);
    }

    function burnStake(
        uint exchangeId,
        uint amount
        )
        public
        returns (uint burnedLRC)
    {
        address exchangeAddress = getExchangeAddress(exchangeId);
        require(msg.sender == exchangeAddress, "UNAUTHORIZED");

        burnedLRC = getStake(exchangeId);

        if (amount < burnedLRC) {
            burnedLRC = amount;
        }
        if (burnedLRC > 0) {
            require(
                BurnableERC20(lrcAddress).burn(burnedLRC),
                "BURN_FAILURE"
            );
            exchangeStakes[exchangeId] -= burnedLRC;
            totalStake -= burnedLRC;
        }
        emit StakeBurned(exchangeId, burnedLRC);
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
        stakedLRC = getStake(exchangeId);
        withdrawStakeTo(exchangeId, msg.sender, stakedLRC);
    }

    function withdrawStakeTo(
        uint exchangeId,
        address recipient,
        uint requestedAmount
        )
        public
        returns (uint amount)
    {
        address exchangeAddress = getExchangeAddress(exchangeId);
        require(msg.sender == exchangeAddress, "UNAUTHORIZED");

        uint stakedLRC = getStake(exchangeId);
        amount = (stakedLRC > requestedAmount) ? requestedAmount : stakedLRC;
        if (amount > 0) {
            require(
                lrcAddress.safeTransferFrom(
                    address(this),
                    recipient,
                    amount
                ),
                "WITHDRAWAL_FAILURE"
            );
            exchangeStakes[exchangeId] -= amount;
            totalStake -= amount;
        }
        emit StakeWithdrawn(exchangeId, amount);
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

    function getLRCCostToBuydownTokenBurnRate(
        address _token
        )
        public
        view
        returns (
            uint amountLRC,
            uint8 currentTier
        )
    {
        require(_token != address(0), "BURN_RATE_FROZEN");
        require(_token != lrcAddress, "BURN_RATE_FROZEN");
        require(_token != wethAddress, "BURN_RATE_FROZEN");

        Token storage token = tokens[_token];

        currentTier = 4;
        if (token.tier != 0 && token.tierValidUntil > now) {
            currentTier = token.tier;
        }

        // Can't upgrade to a higher level than tier 1
        require(currentTier > 1, "BURN_RATE_MINIMIZED");
        uint totalSupply = BurnableERC20(lrcAddress).totalSupply();
        amountLRC = totalSupply.mul(tierUpgradeCostBips) / 10000;
    }

    function buydownTokenBurnRate(
        address _token
        )
        external
        returns (
            uint amountBurned,
            uint8 currentTier
        )
    {
        (amountBurned, currentTier) = getLRCCostToBuydownTokenBurnRate(_token);

        // Burn tierUpgradeCostBips of total LRC supply
        require(BurnableERC20(lrcAddress).burnFrom(msg.sender, amountBurned), "BURN_FAILURE");
        currentTier -= 1;

        // Upgrade tier
        Token storage token = tokens[_token];
        token.tokenAddress = _token;
        token.tier = currentTier;

        if (token.tierValidUntil < now) {
            token.tierValidUntil = now + TIER_UPGRADE_DURATION;
        } else {
            token.tierValidUntil += TIER_UPGRADE_DURATION;
        }

        emit TokenBurnRateDown(_token, token.tier, now);
    }

    function withdrawTheBurn(
        address token,
        address payable recipient
        )
        external
        onlyOwner
    {
        require(token != lrcAddress, "LRC_ALREADY_BURNED");
        if (token == address(0x0)) {
            // ETH
            uint balance = address(this).balance;
            recipient.transfer(balance);
        } else {
            // ERC20 token
            uint balance = ERC20(token).balanceOf(address(this));
            require(token.safeTransfer(recipient, balance), "TRANSFER_FAILURE");
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
}
