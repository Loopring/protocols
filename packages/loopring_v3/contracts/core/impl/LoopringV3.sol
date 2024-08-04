// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../../lib/AddressUtil.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/ReentrancyGuard.sol";
import "../iface/IExchangeV3.sol";
import "../iface/ILoopringV3.sol";

/// @title LoopringV3
/// @dev This contract does NOT support proxy.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract LoopringV3 is ILoopringV3, ReentrancyGuard {
    using AddressUtil for address payable;
    using MathUint for uint;
    using ERC20SafeTransfer for address;

    address public immutable override lrcAddress;

    // -- Constructor --
    constructor(
        address _lrcAddress,
        address payable _protocolFeeVault,
        address _blockVerifierAddress
    ) Claimable() {
        require(address(0) != _lrcAddress, "ZERO_ADDRESS");

        lrcAddress = _lrcAddress;

        updateSettingsInternal(_protocolFeeVault, _blockVerifierAddress, 0, 0);
    }

    // == Public Functions ==
    function updateSettings(
        address payable _protocolFeeVault,
        address _blockVerifierAddress,
        uint _forcedWithdrawalFee
    ) external override nonReentrant onlyOwner {
        updateSettingsInternal(
            _protocolFeeVault,
            _blockVerifierAddress,
            _forcedWithdrawalFee,
            SETTING_UPDATE_DELAY + block.timestamp
        );
    }

    function updateProtocolFeeSettings(
        uint8 _protocolTakerFeeBips,
        uint8 _protocolMakerFeeBips
    ) external override nonReentrant onlyOwner {
        protocolTakerFeeBips = _protocolTakerFeeBips;
        protocolMakerFeeBips = _protocolMakerFeeBips;

        emit SettingsUpdated(block.timestamp, 0);
    }

    function getExchangeStake(
        address exchangeAddr
    ) public view override returns (uint) {
        return exchangeStake[exchangeAddr];
    }

    function burnExchangeStake(
        uint amount
    ) external override nonReentrant returns (uint burnedLRC) {
        burnedLRC = exchangeStake[msg.sender];

        if (amount < burnedLRC) {
            burnedLRC = amount;
        }
        if (burnedLRC > 0) {
            lrcAddress.safeTransferAndVerify(protocolFeeVault, burnedLRC);
            exchangeStake[msg.sender] = exchangeStake[msg.sender].sub(
                burnedLRC
            );
            totalStake = totalStake.sub(burnedLRC);
        }
        emit ExchangeStakeBurned(msg.sender, burnedLRC);
    }

    function depositExchangeStake(
        address exchangeAddr,
        uint amountLRC
    ) external override nonReentrant returns (uint stakedLRC) {
        require(amountLRC > 0, "ZERO_VALUE");

        lrcAddress.safeTransferFromAndVerify(
            msg.sender,
            address(this),
            amountLRC
        );

        stakedLRC = exchangeStake[exchangeAddr].add(amountLRC);
        exchangeStake[exchangeAddr] = stakedLRC;
        totalStake = totalStake.add(amountLRC);

        emit ExchangeStakeDeposited(exchangeAddr, amountLRC);
    }

    function withdrawExchangeStake(
        address recipient,
        uint requestedAmount
    ) external override nonReentrant returns (uint amountLRC) {
        uint stake = exchangeStake[msg.sender];
        amountLRC = (stake > requestedAmount) ? requestedAmount : stake;

        if (amountLRC > 0) {
            lrcAddress.safeTransferAndVerify(recipient, amountLRC);
            exchangeStake[msg.sender] = exchangeStake[msg.sender].sub(
                amountLRC
            );
            totalStake = totalStake.sub(amountLRC);
        }

        emit ExchangeStakeWithdrawn(msg.sender, amountLRC);
    }

    function getProtocolFeeValues()
        public
        view
        override
        returns (uint8 takerFeeBips, uint8 makerFeeBips)
    {
        return (protocolTakerFeeBips, protocolMakerFeeBips);
    }

    // == Internal Functions ==
    function updateSettingsInternal(
        address payable _protocolFeeVault,
        address _blockVerifierAddress,
        uint _forcedWithdrawalFee,
        uint _nextEffectiveTime
    ) private {
        require(address(0) != _protocolFeeVault, "ZERO_ADDRESS");
        require(address(0) != _blockVerifierAddress, "ZERO_ADDRESS");
        require(
            _forcedWithdrawalFee <= 0.5 ether,
            "FORCED_WITHDRAWAL_FEE_TOO_HIGH"
        );

        if (_nextEffectiveTime == 0) {
            // effect immediately
            protocolFeeVault = _protocolFeeVault;
            blockVerifierAddress = _blockVerifierAddress;
            forcedWithdrawalFee = _forcedWithdrawalFee;
        } else {
            // delayed effect
            cachedSettings = CachedSettings({
                protocolFeeVault: _protocolFeeVault,
                blockVerifierAddress: _blockVerifierAddress,
                forcedWithdrawalFee: _forcedWithdrawalFee
            });
            nextEffectiveTime = _nextEffectiveTime;
        }

        emit SettingsUpdated(block.timestamp, _nextEffectiveTime);
    }

    function applyUpdate() external {
        require(nextEffectiveTime > 0, "NO_ANY_UPDATES");
        require(nextEffectiveTime <= block.timestamp, "NOT_ENABLED_YET");

        protocolFeeVault = payable(cachedSettings.protocolFeeVault);
        blockVerifierAddress = cachedSettings.blockVerifierAddress;
        forcedWithdrawalFee = cachedSettings.forcedWithdrawalFee;

        // clear updates
        nextEffectiveTime = 0;

        delete cachedSettings;

        emit SettingsApplied(block.timestamp);
    }
}
