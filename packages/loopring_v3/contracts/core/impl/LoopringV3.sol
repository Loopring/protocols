// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../../lib/AddressUtil.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
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
        address payable _protocolFeeVault,
        address _blockVerifierAddress
        )
        Claimable()
    {
        require(address(0) != _universalRegistry, "ZERO_ADDRESS");
        require(address(0) != _lrcAddress, "ZERO_ADDRESS");

        universalRegistry = _universalRegistry;
        lrcAddress = _lrcAddress;

        updateSettingsInternal(
            _protocolFeeVault,
            _blockVerifierAddress,
            0, 0, 0
        );
    }

    // === ILoopring methods ===

    modifier onlyUniversalRegistry()
    {
        require(msg.sender == universalRegistry, "UNAUTHORIZED");
        _;
    }

    function initializeExchange(
        address exchangeAddr,
        address owner,
        bytes32 genesisMerkleRoot
        )
        external
        override
        nonReentrant
        onlyUniversalRegistry
    {
        require(exchangeAddr != address(0), "ZERO_ADDRESS");
        require(owner != address(0), "ZERO_ADDRESS");
        require(exchanges[exchangeAddr].exchangeAddr == address(0), "ID_USED_ALREADY");

        IExchangeV3 exchange = IExchangeV3(exchangeAddr);

        // If the exchange has already been initialized, the following function will throw.
        exchange.initialize(
            address(this),
            owner,
            genesisMerkleRoot
        );

        exchanges[exchangeAddr] = Exchange(exchangeAddr, 0);

        emit ExchangeInitialized(
            exchangeAddr,
            owner,
            genesisMerkleRoot
        );
    }

    // == Public Functions ==
    function updateSettings(
        address payable _protocolFeeVault,
        address _blockVerifierAddress,
        uint    _exchangeCreationCostLRC,
        uint    _forcedWithdrawalFee,
        uint    _stakePerThousandBlocks
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
            _stakePerThousandBlocks
        );
    }

    function updateProtocolFeeSettings(
        uint8 _protocolTakerFeeBips,
        uint8 _protocolMakerFeeBips
        )
        external
        override
        nonReentrant
        onlyOwner
    {
        protocolTakerFeeBips = _protocolTakerFeeBips;
        protocolMakerFeeBips = _protocolMakerFeeBips;

        emit SettingsUpdated(block.timestamp);
    }

    function getExchangeStake(
        address exchangeAddr
        )
        public
        override
        view
        returns (uint)
    {
        Exchange storage exchange = exchanges[exchangeAddr];
        require(exchange.exchangeAddr != address(0), "INVALID_EXCHANGE_ADDRESS");
        return exchange.exchangeStake;
    }

    function burnExchangeStake(
        uint amount
        )
        external
        override
        nonReentrant
        returns (uint burnedLRC)
    {
        Exchange storage exchange = exchanges[msg.sender];
        require(exchange.exchangeAddr == msg.sender, "INVALID_EXCHANGE");

        burnedLRC = exchange.exchangeStake;

        if (amount < burnedLRC) {
            burnedLRC = amount;
        }
        if (burnedLRC > 0) {
            lrcAddress.safeTransferAndVerify(protocolFeeVault, burnedLRC);
            exchange.exchangeStake = exchange.exchangeStake.sub(burnedLRC);
            totalStake = totalStake.sub(burnedLRC);
        }
        emit ExchangeStakeBurned(msg.sender, burnedLRC);
    }

    function depositExchangeStake(
        address exchangeAddr,
        uint amountLRC
        )
        external
        override
        nonReentrant
        returns (uint stakedLRC)
    {
        require(amountLRC > 0, "ZERO_VALUE");

        Exchange storage exchange = exchanges[exchangeAddr];
        require(exchange.exchangeAddr != address(0), "INVALID_EXCHANGE_ADDRESS");

        lrcAddress.safeTransferFromAndVerify(msg.sender, address(this), amountLRC);

        stakedLRC = exchange.exchangeStake.add(amountLRC);
        exchange.exchangeStake = stakedLRC;
        totalStake = totalStake.add(amountLRC);

        emit ExchangeStakeDeposited(exchangeAddr, amountLRC);
    }

    function withdrawExchangeStake(
        address recipient,
        uint    requestedAmount
        )
        external
        override
        nonReentrant
        returns (uint amountLRC)
    {
        Exchange storage exchange = exchanges[msg.sender];
        require(exchange.exchangeAddr != address(0), "INVALID_EXCHANGE_ADDRESS");

        amountLRC = (exchange.exchangeStake > requestedAmount) ?
            requestedAmount : exchange.exchangeStake;

        if (amountLRC > 0) {
            lrcAddress.safeTransferAndVerify(recipient, amountLRC);
            exchange.exchangeStake = exchange.exchangeStake.sub(amountLRC);
            totalStake = totalStake.sub(amountLRC);
        }

        emit ExchangeStakeWithdrawn(msg.sender, amountLRC);
    }

    function getProtocolFeeValues()
        public
        override
        view
        returns (
            uint8 takerFeeBips,
            uint8 makerFeeBips
        )
    {
        return (protocolTakerFeeBips, protocolMakerFeeBips);
    }

    // == Internal Functions ==
    function updateSettingsInternal(
        address payable  _protocolFeeVault,
        address _blockVerifierAddress,
        uint    _exchangeCreationCostLRC,
        uint    _forcedWithdrawalFee,
        uint    _stakePerThousandBlocks
        )
        private
    {
        require(address(0) != _protocolFeeVault, "ZERO_ADDRESS");
        require(address(0) != _blockVerifierAddress, "ZERO_ADDRESS");

        protocolFeeVault = _protocolFeeVault;
        blockVerifierAddress = _blockVerifierAddress;
        exchangeCreationCostLRC = _exchangeCreationCostLRC;
        forcedWithdrawalFee = _forcedWithdrawalFee;
        stakePerThousandBlocks = _stakePerThousandBlocks;

        emit SettingsUpdated(block.timestamp);
    }
}
