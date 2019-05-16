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
pragma solidity 0.5.7;

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

        updateSettingsInternal(
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
        external
        onlyOwner
    {
        updateSettingsInternal(
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
            exchangeStakes[exchangeId - 1] = exchangeStakes[exchangeId - 1].sub(burnedLRC);
            totalStake = totalStake.sub(burnedLRC);
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
        stakedLRC = exchangeStakes[exchangeId - 1].add(amountLRC);
        exchangeStakes[exchangeId - 1] = stakedLRC;
        totalStake = totalStake.add(amountLRC);
        emit StakeDeposited(exchangeId, amountLRC);
    }

    function withdrawStake(
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
                lrcAddress.safeTransfer(
                    recipient,
                    amount
                ),
                "WITHDRAWAL_FAILURE"
            );
            exchangeStakes[exchangeId - 1] = exchangeStakes[exchangeId - 1].sub(amount);
            totalStake = totalStake.sub(amount);
        }
        emit StakeWithdrawn(exchangeId, amount);
    }

    function getProtocolFees(
        uint exchangeId
        )
        external
        view
        returns (uint8 takerFeeBips, uint8 makerFeeBips)
    {
        takerFeeBips = 50;
        makerFeeBips = 25;
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

    function()
        external
        payable
    {}

    // == Internal Functions ==
    function updateSettingsInternal(
        address _blockVerifierAddress,
        uint    _exchangeCreationCostLRC,
        uint16  _tierUpgradeCostBips,
        uint    _maxWithdrawalFee,
        uint    _downtimePriceLRCPerDay,
        uint    _withdrawalFineLRC,
        uint    _tokenRegistrationFeeLRCBase,
        uint    _tokenRegistrationFeeLRCDelta
        )
        private
    {
        require(address(0) != _blockVerifierAddress, "ZERO_ADDRESS");

        blockVerifierAddress = _blockVerifierAddress;
        exchangeCreationCostLRC = _exchangeCreationCostLRC;
        maxWithdrawalFee = _maxWithdrawalFee;
        downtimePriceLRCPerDay = _downtimePriceLRCPerDay;
        withdrawalFineLRC = _withdrawalFineLRC;
        tokenRegistrationFeeLRCBase = _tokenRegistrationFeeLRCBase;
        tokenRegistrationFeeLRCDelta = _tokenRegistrationFeeLRCDelta;

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
        return exchanges[exchangeId - 1];
    }
}
