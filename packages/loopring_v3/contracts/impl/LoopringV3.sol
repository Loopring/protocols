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

import "../iface/ILoopringV3.sol";
import "../iface/IExchange.sol";

import "../lib/BurnableERC20.sol";
import "../lib/Claimable.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";

import "./ExchangeDeployer.sol";


/// @title An Implementation of ILoopring.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract LoopringV3 is ILoopringV3, Claimable
{
    using AddressUtil       for address payable;
    using MathUint          for uint;
    using ERC20SafeTransfer for address;

    // -- Constructor --
    constructor(
        address payable _protocolFeeVault,
        address _lrcAddress,
        address _wethAddress,
        address _blockVerifierAddress,
        uint    _exchangeCreationCostLRC,
        uint    _maxWithdrawalFee,
        uint    _downtimePriceLRCPerMinute,
        uint    _tokenRegistrationFeeLRCBase,
        uint    _tokenRegistrationFeeLRCDelta,
        uint    _minExchangeStakeWithDataAvailability,
        uint    _minExchangeStakeWithoutDataAvailability,
        uint    _revertFineLRC,
        uint    _withdrawalFineLRC
        )
        public
    {
        require(address(0) != _protocolFeeVault, "ZERO_ADDRESS");
        require(address(0) != _lrcAddress, "ZERO_ADDRESS");
        require(address(0) != _wethAddress, "ZERO_ADDRESS");

        protocolFeeVault = _protocolFeeVault;
        lrcAddress = _lrcAddress;
        wethAddress = _wethAddress;

        updateSettingsInternal(
            _blockVerifierAddress,
            _exchangeCreationCostLRC,
            _maxWithdrawalFee,
            _downtimePriceLRCPerMinute,
            _tokenRegistrationFeeLRCBase,
            _tokenRegistrationFeeLRCDelta,
            _minExchangeStakeWithDataAvailability,
            _minExchangeStakeWithoutDataAvailability,
            _revertFineLRC,
            _withdrawalFineLRC
        );
    }

    // == Public Functions ==
    function updateSettings(
        address _blockVerifierAddress,
        uint    _exchangeCreationCostLRC,
        uint    _maxWithdrawalFee,
        uint    _downtimePriceLRCPerMinute,
        uint    _tokenRegistrationFeeLRCBase,
        uint    _tokenRegistrationFeeLRCDelta,
        uint    _minExchangeStakeWithDataAvailability,
        uint    _minExchangeStakeWithoutDataAvailability,
        uint    _revertFineLRC,
        uint    _withdrawalFineLRC
        )
        external
        onlyOwner
    {
        updateSettingsInternal(
            _blockVerifierAddress,
            _exchangeCreationCostLRC,
            _maxWithdrawalFee,
            _downtimePriceLRCPerMinute,
            _tokenRegistrationFeeLRCBase,
            _tokenRegistrationFeeLRCDelta,
            _minExchangeStakeWithDataAvailability,
            _minExchangeStakeWithoutDataAvailability,
            _revertFineLRC,
            _withdrawalFineLRC
        );
    }

    function updateProtocolFeeSettings(
        uint8 _minProtocolTakerFeeBips,
        uint8 _maxProtocolTakerFeeBips,
        uint8 _minProtocolMakerFeeBips,
        uint8 _maxProtocolMakerFeeBips,
        uint  _targetProtocolTakerFeeStake,
        uint  _targetProtocolMakerFeeStake
        )
        external
        onlyOwner
    {
        minProtocolTakerFeeBips = _minProtocolTakerFeeBips;
        maxProtocolTakerFeeBips = _maxProtocolTakerFeeBips;
        minProtocolMakerFeeBips = _minProtocolMakerFeeBips;
        maxProtocolMakerFeeBips = _maxProtocolMakerFeeBips;
        targetProtocolTakerFeeStake = _targetProtocolTakerFeeStake;
        targetProtocolMakerFeeStake = _targetProtocolMakerFeeStake;

        emit SettingsUpdated(now);
    }

    function setProtocolFeeVault(
        address payable _protocolFeeVault
        )
        external
        onlyOwner
    {
        require(_protocolFeeVault != address(0), "ZERO_ADDRESS");
        protocolFeeVault = _protocolFeeVault;

        emit ProtocolFeeVaultUpdated(protocolFeeVault);
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

        Exchange memory exchange = Exchange(
            exchangeAddress,
            0,
            0
        );
        exchanges.push(exchange);

        emit ExchangeCreated(
            exchangeId,
            exchangeAddress,
            msg.sender,
            operator,
            exchangeCreationCostLRC
        );
    }

    function canExchangeCommitBlocks(
        uint exchangeId,
        bool onchainDataAvailability
        )
        external
        view
        returns (bool)
    {
        uint amountStaked = getExchangeStake(exchangeId);
        if (onchainDataAvailability) {
            return amountStaked >= minExchangeStakeWithDataAvailability;
        } else {
            return amountStaked >= minExchangeStakeWithoutDataAvailability;
        }
    }

    function getExchangeStake(
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
        return exchanges[exchangeId - 1].exchangeStake;
    }

    function burnExchangeStake(
        uint exchangeId,
        uint amount
        )
        public
        returns (uint burnedLRC)
    {
        address exchangeAddress = getExchangeAddress(exchangeId);
        require(msg.sender == exchangeAddress, "UNAUTHORIZED");

        burnedLRC = getExchangeStake(exchangeId);

        if (amount < burnedLRC) {
            burnedLRC = amount;
        }
        if (burnedLRC > 0) {
            require(
                BurnableERC20(lrcAddress).burn(burnedLRC),
                "BURN_FAILURE"
            );
            exchanges[exchangeId - 1].exchangeStake = exchanges[exchangeId - 1].exchangeStake.sub(burnedLRC);
            totalStake = totalStake.sub(burnedLRC);
        }
        emit ExchangeStakeBurned(exchangeId, burnedLRC);
    }

    function depositExchangeStake(
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
        stakedLRC = exchanges[exchangeId - 1].exchangeStake.add(amountLRC);
        exchanges[exchangeId - 1].exchangeStake = stakedLRC;
        totalStake = totalStake.add(amountLRC);
        emit ExchangeStakeDeposited(exchangeId, amountLRC);
    }

    function withdrawExchangeStake(
        uint    exchangeId,
        address recipient,
        uint    requestedAmount
        )
        public
        returns (uint amount)
    {
        address exchangeAddress = getExchangeAddress(exchangeId);
        require(msg.sender == exchangeAddress, "UNAUTHORIZED");

        uint stakedLRC = getExchangeStake(exchangeId);
        amount = (stakedLRC > requestedAmount) ? requestedAmount : stakedLRC;
        if (amount > 0) {
            require(
                lrcAddress.safeTransfer(
                    recipient,
                    amount
                ),
                "WITHDRAWAL_FAILURE"
            );
            exchanges[exchangeId - 1].exchangeStake = exchanges[exchangeId - 1].exchangeStake.sub(amount);
            totalStake = totalStake.sub(amount);
        }
        emit ExchangeStakeWithdrawn(exchangeId, amount);
    }

    function getProtocolFeeStake(
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
        return exchanges[exchangeId - 1].protocolFeeStake;
    }

    function depositProtocolFeeStake(
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
        stakedLRC = exchanges[exchangeId - 1].protocolFeeStake.add(amountLRC);
        exchanges[exchangeId - 1].protocolFeeStake = stakedLRC;
        totalStake = totalStake.add(amountLRC);
        emit ProtocolFeeStakeDeposited(exchangeId, amountLRC);
    }

    function withdrawProtocolFeeStake(
        uint    exchangeId,
        address recipient,
        uint    amount
        )
        external
    {
        address exchangeAddress = getExchangeAddress(exchangeId);
        require(msg.sender == exchangeAddress, "UNAUTHORIZED");

        uint stakedLRC = getProtocolFeeStake(exchangeId);
        require(amount >= stakedLRC, "INSUFFICIENT_STAKE");
        if (amount > 0) {
            require(
                lrcAddress.safeTransfer(
                    recipient,
                    amount
                ),
                "WITHDRAWAL_FAILURE"
            );
            exchanges[exchangeId - 1].protocolFeeStake = exchanges[exchangeId - 1].protocolFeeStake.sub(amount);
            totalStake = totalStake.sub(amount);
        }
        emit ProtocolFeeStakeWithdrawn(exchangeId, amount);
    }

    function getProtocolFeeValues(
        uint exchangeId,
        bool onchainDataAvailability
        )
        external
        view
        returns (
            uint8 takerFeeBips,
            uint8 makerFeeBips
        )
    {
        Exchange storage exchange = exchanges[exchangeId - 1];

        // Subtract the minimum exchange stake, this amount cannot be used to reduce the protocol fees
        uint stake = 0;
        if (onchainDataAvailability && exchange.exchangeStake > minExchangeStakeWithDataAvailability) {
            stake = exchange.exchangeStake - minExchangeStakeWithDataAvailability;
        } else if (!onchainDataAvailability && exchange.exchangeStake > minExchangeStakeWithoutDataAvailability) {
            stake = exchange.exchangeStake - minExchangeStakeWithoutDataAvailability;
        }

        // The total stake used here is the exchange stake + the protocol fee stake, but
        // the protocol fee stake has a reduced weight of 50%.
        uint protocolFeeStake = stake.add(exchange.protocolFeeStake / 2);

        takerFeeBips = calculateProtocolFee(
            minProtocolTakerFeeBips, maxProtocolTakerFeeBips, protocolFeeStake, targetProtocolTakerFeeStake
        );
        makerFeeBips = calculateProtocolFee(
            minProtocolMakerFeeBips, maxProtocolMakerFeeBips, protocolFeeStake, targetProtocolMakerFeeStake
        );
    }

    function()
        external
        payable
    {}

    // == Internal Functions ==
    function updateSettingsInternal(
        address _blockVerifierAddress,
        uint    _exchangeCreationCostLRC,
        uint    _maxWithdrawalFee,
        uint    _downtimePriceLRCPerMinute,
        uint    _tokenRegistrationFeeLRCBase,
        uint    _tokenRegistrationFeeLRCDelta,
        uint    _minExchangeStakeWithDataAvailability,
        uint    _minExchangeStakeWithoutDataAvailability,
        uint    _revertFineLRC,
        uint    _withdrawalFineLRC
        )
        private
    {
        require(address(0) != _blockVerifierAddress, "ZERO_ADDRESS");

        blockVerifierAddress = _blockVerifierAddress;
        exchangeCreationCostLRC = _exchangeCreationCostLRC;
        maxWithdrawalFee = _maxWithdrawalFee;
        downtimePriceLRCPerMinute = _downtimePriceLRCPerMinute;
        tokenRegistrationFeeLRCBase = _tokenRegistrationFeeLRCBase;
        tokenRegistrationFeeLRCDelta = _tokenRegistrationFeeLRCDelta;
        minExchangeStakeWithDataAvailability = _minExchangeStakeWithDataAvailability;
        minExchangeStakeWithoutDataAvailability = _minExchangeStakeWithoutDataAvailability;
        revertFineLRC = _revertFineLRC;
        withdrawalFineLRC = _withdrawalFineLRC;

        emit SettingsUpdated(now);
    }

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
        return exchanges[exchangeId - 1].exchangeAddress;
    }

    function calculateProtocolFee(
        uint minFee,
        uint maxFee,
        uint stake,
        uint targetStake
        )
        internal
        pure
        returns (uint8)
    {
        if (targetStake > 0) {
            // Simple linear interpolation between 2 points
            uint maxReduction = maxFee.sub(minFee);
            uint reduction = maxReduction.mul(stake) / targetStake;
            if (reduction > maxReduction) {
                reduction = maxReduction;
            }
            return uint8(maxFee.sub(reduction));
        } else {
            return uint8(minFee);
        }
    }
}
