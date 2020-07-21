// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;

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
        address _blockVerifierAddress
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
            0, 0, 0, 0
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
        bool    rollupMode
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
            rollupMode
        );

        exchanges[exchangeId] = Exchange(exchangeAddress, 0, 0);

        emit ExchangeInitialized(
            exchangeId,
            exchangeAddress,
            owner,
            operator,
            rollupMode
        );
    }

    // == Public Functions ==
    function updateSettings(
        address payable _protocolFeeVault,
        address _blockVerifierAddress,
        uint    _exchangeCreationCostLRC,
        uint    _forcedWithdrawalFee,
        uint    _minExchangeStakeRollup,
        uint    _minExchangeStakeValidium
        )
        external
        override
        nonReentrant
        onlyOwner
    {
        updateSettingsInternal(
            _protocolFeeVault,
            _blockVerifierAddress,
            _exchangeCreationCostLRC,
            _forcedWithdrawalFee,
            _minExchangeStakeRollup,
            _minExchangeStakeValidium
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

    function canExchangeSubmitBlocks(
        uint exchangeId,
        bool rollupMode
        )
        external
        override
        view
        returns (bool)
    {
        uint amountStaked = getExchangeStake(exchangeId);
        if (rollupMode) {
            return amountStaked >= minExchangeStakeRollup;
        } else {
            return amountStaked >= minExchangeStakeValidium;
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
        bool rollupMode
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
        if (rollupMode && exchange.exchangeStake > minExchangeStakeRollup) {
            stake = exchange.exchangeStake - minExchangeStakeRollup;
        } else if (!rollupMode && exchange.exchangeStake > minExchangeStakeValidium) {
            stake = exchange.exchangeStake - minExchangeStakeValidium;
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
        uint    _exchangeCreationCostLRC,
        uint    _forcedWithdrawalFee,
        uint    _minExchangeStakeRollup,
        uint    _minExchangeStakeValidium
        )
        private
    {
        require(address(0) != _protocolFeeVault, "ZERO_ADDRESS");
        require(address(0) != _blockVerifierAddress, "ZERO_ADDRESS");

        protocolFeeVault = _protocolFeeVault;
        blockVerifierAddress = _blockVerifierAddress;
        exchangeCreationCostLRC = _exchangeCreationCostLRC;
        forcedWithdrawalFee = _forcedWithdrawalFee;
        minExchangeStakeRollup = _minExchangeStakeRollup;
        minExchangeStakeValidium = _minExchangeStakeValidium;

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
