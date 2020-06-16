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
pragma solidity ^0.6.6;

import "../lib/AddressUtil.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";

import "../iface/IExchangeV3.sol";
import "../iface/ILoopringV3.sol";


/// @title LoopringV3
/// @dev This contract does NOT support proxy.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract LoopringV3 is ILoopringV3
{
    using AddressUtil       for address payable;
    using MathUint          for uint;
    using ERC20SafeTransfer for address;

    // -- Constructor --
    constructor(
        address _universalRegistry,
        address _lrcAddress,
        address _wethAddress,
        address payable _protocolFeeVault,
        address _blockVerifierAddress,
        address _downtimeCostCalculator
        )
        Claimable()
        public
    {
        require(address(0) != _universalRegistry, "ZERO_ADDRESS");
        require(address(0) != _lrcAddress, "ZERO_ADDRESS");
        require(address(0) != _wethAddress, "ZERO_ADDRESS");

        universalRegistry = _universalRegistry;
        lrcAddress = _lrcAddress;
        wethAddress = _wethAddress;

        updateSettingsInternal(
            _protocolFeeVault,
            _blockVerifierAddress,
            _downtimeCostCalculator,
            0, 0, 0, 0, 0, 0, 0, 0
        );
    }

    // === ILoopring methods ===

    modifier onlyUniversalRegistry()
    {
        require(msg.sender == universalRegistry, "UNAUTHORIZED");
        _;
    }

    function initializeExchange(
        address exchangeAddress,
        uint    exchangeId,
        address owner,
        address payable operator,
        bool    onchainDataAvailability,
        address insuranceContract
        )
        external
        override
        nonReentrant
        onlyUniversalRegistry
    {
        require(exchangeId != 0, "ZERO_ID");
        require(exchangeAddress != address(0), "ZERO_ADDRESS");
        require(owner != address(0), "ZERO_ADDRESS");
        require(operator != address(0), "ZERO_ADDRESS");
        require(exchanges[exchangeId].exchangeAddress == address(0), "ID_USED_ALREADY");

        IExchangeV3 exchange = IExchangeV3(exchangeAddress);

        // If the exchange has already been initialized, the following function will throw.
        exchange.initialize(
            address(this),
            owner,
            exchangeId,
            operator,
            onchainDataAvailability,
            insuranceContract
        );

        exchanges[exchangeId] = Exchange(exchangeAddress, 0, 0);

        emit ExchangeInitialized(
            exchangeId,
            exchangeAddress,
            owner,
            operator,
            onchainDataAvailability
        );
    }

    // == Public Functions ==
    function updateSettings(
        address payable _protocolFeeVault,
        address _blockVerifierAddress,
        address _downtimeCostCalculator,
        uint    _exchangeCreationCostLRC,
        uint    _maxWithdrawalFee,
        uint    _tokenRegistrationFeeLRCBase,
        uint    _tokenRegistrationFeeLRCDelta,
        uint    _minExchangeStakeWithDataAvailability,
        uint    _minExchangeStakeWithoutDataAvailability,
        uint    _revertFineLRC,
        uint    _withdrawalFineLRC
        )
        external
        override
        nonReentrant
        onlyOwner
    {
        updateSettingsInternal(
            _protocolFeeVault,
            _blockVerifierAddress,
            _downtimeCostCalculator,
            _exchangeCreationCostLRC,
            _maxWithdrawalFee,
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
        override
        nonReentrant
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

    function canExchangeCommitBlocks(
        uint exchangeId,
        bool onchainDataAvailability
        )
        external
        override
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
        override
        view
        returns (uint)
    {
        Exchange storage exchange = exchanges[exchangeId];
        require(exchange.exchangeAddress != address(0), "INVALID_EXCHANGE_ID");
        return exchange.exchangeStake;
    }

    function burnExchangeStake(
        uint exchangeId,
        uint amount
        )
        external
        override
        nonReentrant
        returns (uint burnedLRC)
    {
        Exchange storage exchange = exchanges[exchangeId];
        address exchangeAddress = exchange.exchangeAddress;

        require(exchangeAddress != address(0), "INVALID_EXCHANGE_ID");
        require(exchangeAddress == msg.sender, "UNAUTHORIZED");

        burnedLRC = exchange.exchangeStake;

        if (amount < burnedLRC) {
            burnedLRC = amount;
        }
        if (burnedLRC > 0) {
            lrcAddress.safeTransferAndVerify(protocolFeeVault, burnedLRC);
            exchange.exchangeStake = exchange.exchangeStake.sub(burnedLRC);
            totalStake = totalStake.sub(burnedLRC);
        }
        emit ExchangeStakeBurned(exchangeId, burnedLRC);
    }

    function depositExchangeStake(
        uint exchangeId,
        uint amountLRC
        )
        external
        override
        nonReentrant
        returns (uint stakedLRC)
    {
        require(amountLRC > 0, "ZERO_VALUE");

        Exchange storage exchange = exchanges[exchangeId];
        require(exchange.exchangeAddress != address(0), "INVALID_EXCHANGE_ID");

        lrcAddress.safeTransferFromAndVerify(msg.sender, address(this), amountLRC);

        stakedLRC = exchange.exchangeStake.add(amountLRC);
        exchange.exchangeStake = stakedLRC;
        totalStake = totalStake.add(amountLRC);

        emit ExchangeStakeDeposited(exchangeId, amountLRC);
    }

    function withdrawExchangeStake(
        uint    exchangeId,
        address recipient,
        uint    requestedAmount
        )
        external
        override
        nonReentrant
        returns (uint amountLRC)
    {
        Exchange storage exchange = exchanges[exchangeId];
        require(exchange.exchangeAddress != address(0), "INVALID_EXCHANGE_ID");
        require(exchange.exchangeAddress == msg.sender, "UNAUTHORIZED");

        amountLRC = (exchange.exchangeStake > requestedAmount) ?
            requestedAmount : exchange.exchangeStake;

        if (amountLRC > 0) {
            lrcAddress.safeTransferAndVerify(recipient, amountLRC);
            exchange.exchangeStake = exchange.exchangeStake.sub(amountLRC);
            totalStake = totalStake.sub(amountLRC);
        }

        emit ExchangeStakeWithdrawn(exchangeId, amountLRC);
    }

    function depositProtocolFeeStake(
        uint exchangeId,
        uint amountLRC
        )
        external
        override
        nonReentrant
        returns (uint stakedLRC)
    {
        require(amountLRC > 0, "ZERO_VALUE");

        Exchange storage exchange = exchanges[exchangeId];
        require(exchange.exchangeAddress != address(0), "INVALID_EXCHANGE_ID");

        lrcAddress.safeTransferFromAndVerify(msg.sender, address(this), amountLRC);

        stakedLRC = exchange.protocolFeeStake.add(amountLRC);
        exchange.protocolFeeStake = stakedLRC;
        totalStake = totalStake.add(amountLRC);

        emit ProtocolFeeStakeDeposited(exchangeId, amountLRC);
    }

    function withdrawProtocolFeeStake(
        uint    exchangeId,
        address recipient,
        uint    amountLRC
        )
        external
        override
        nonReentrant
    {
        Exchange storage exchange = exchanges[exchangeId];
        require(exchange.exchangeAddress != address(0), "INVALID_EXCHANGE_ID");
        require(exchange.exchangeAddress == msg.sender, "UNAUTHORIZED");
        require(amountLRC <= exchange.protocolFeeStake, "INSUFFICIENT_STAKE");

        if (amountLRC > 0) {
            lrcAddress.safeTransferAndVerify(recipient, amountLRC);
            exchange.protocolFeeStake = exchange.protocolFeeStake.sub(amountLRC);
            totalStake = totalStake.sub(amountLRC);
        }
        emit ProtocolFeeStakeWithdrawn(exchangeId, amountLRC);
    }

    function getProtocolFeeValues(
        uint exchangeId,
        bool onchainDataAvailability
        )
        external
        override
        view
        returns (
            uint8 takerFeeBips,
            uint8 makerFeeBips
        )
    {
        Exchange storage exchange = exchanges[exchangeId];
        require(exchange.exchangeAddress != address(0), "INVALID_EXCHANGE_ID");

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

    function getProtocolFeeStake(
        uint exchangeId
        )
        external
        override
        view
        returns (uint)
    {
        Exchange storage exchange = exchanges[exchangeId];
        require(exchange.exchangeAddress != address(0), "INVALID_EXCHANGE_ID");
        return exchange.protocolFeeStake;
    }

    // == Internal Functions ==
    function updateSettingsInternal(
        address payable  _protocolFeeVault,
        address _blockVerifierAddress,
        address _downtimeCostCalculator,
        uint    _exchangeCreationCostLRC,
        uint    _maxWithdrawalFee,
        uint    _tokenRegistrationFeeLRCBase,
        uint    _tokenRegistrationFeeLRCDelta,
        uint    _minExchangeStakeWithDataAvailability,
        uint    _minExchangeStakeWithoutDataAvailability,
        uint    _revertFineLRC,
        uint    _withdrawalFineLRC
        )
        private
    {
        require(address(0) != _protocolFeeVault, "ZERO_ADDRESS");
        require(address(0) != _blockVerifierAddress, "ZERO_ADDRESS");
        require(address(0) != _downtimeCostCalculator, "ZERO_ADDRESS");

        protocolFeeVault = _protocolFeeVault;
        blockVerifierAddress = _blockVerifierAddress;
        downtimeCostCalculator = _downtimeCostCalculator;
        exchangeCreationCostLRC = _exchangeCreationCostLRC;
        maxWithdrawalFee = _maxWithdrawalFee;
        tokenRegistrationFeeLRCBase = _tokenRegistrationFeeLRCBase;
        tokenRegistrationFeeLRCDelta = _tokenRegistrationFeeLRCDelta;
        minExchangeStakeWithDataAvailability = _minExchangeStakeWithDataAvailability;
        minExchangeStakeWithoutDataAvailability = _minExchangeStakeWithoutDataAvailability;
        revertFineLRC = _revertFineLRC;
        withdrawalFineLRC = _withdrawalFineLRC;

        emit SettingsUpdated(now);
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
