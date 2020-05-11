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
pragma experimental ABIEncoderV2;

import "../../lib/ERC20.sol";
import "../../lib/MathUint.sol";
import "../../lib/Ownable.sol";

import "../../thirdparty/loopring/IProtocolFeeVault.sol";
import "../../thirdparty/loopring/IUserStakingPool.sol";

import "./base/SubAccountDAppModule.sol";


/// @title LRCStakingModule
contract LRCStakingModule is Ownable, SubAccountDAppModule
{
    using MathUint for uint;

    IUserStakingPool  public stakingPool;
    IProtocolFeeVault public feeVault;
    address           public lrcTokenAddress;

    constructor(
        Controller       _controller
        )
        public
        Ownable()
        SecurityModule(_controller)
    {
    }

    function init(
        address wallet,
        IUserStakingPool _stakingPool,
        address          _lrcTokenAddress
        )
        external
        onlyOwner
    {
        require(lrcTokenAddress == address(0), "INITIALIZED_ALREADY");
        require(_lrcTokenAddress != address(0), "ZERO_ADDRESS");

        stakingPool = _stakingPool;
        feeVault = IProtocolFeeVault(stakingPool.protocolFeeVaultAddress());
        lrcTokenAddress = _lrcTokenAddress;
    }

    function deposit(
        address wallet,
        address token,
        uint    amount
        )
        external
        override
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        require(token == lrcTokenAddress, "LRC_ONLY");
        require(amount > 0, "ZERO_AMOUNT");
        require(canDepositToken(wallet, token, amount), "NOT_ALLOWED");

        if (ERC20(token).allowance(wallet, address(stakingPool)) < amount) {
            bytes memory txData = abi.encodeWithSelector(
                ERC20(token).approve.selector,
                address(stakingPool),
                amount
            );
            transactCall(wallet, token, 0, txData);
        }

        bytes memory txData = abi.encodeWithSelector(
            stakingPool.stake.selector,
            amount
        );
        transactCall(wallet, address(stakingPool), 0, txData);
        trackDeposit(wallet, token, amount);
    }

    function withdraw(
        address wallet,
        address token,
        uint    amount
        )
        external
        override
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        require(token == lrcTokenAddress, "LRC_ONLY");

        (, uint rewardWaitTime, , uint pendingReward) = stakingPool.getUserStaking(wallet);

        if (amount == 0) {
            // claim LRC reward.
            require(rewardWaitTime == 0 && pendingReward > 0, "UNABLE_TO_CLAIM");
            bytes memory txData = abi.encodeWithSelector(stakingPool.claim.selector);
            transactCall(wallet, address(stakingPool), 0, txData);
        } else {
             // withdraw LRC
            require(canWithdrawToken(wallet, token, amount), "NOT_ALLOWED");
            bytes memory txData = abi.encodeWithSelector(
                stakingPool.withdraw.selector,
                amount
            );
            transactCall(wallet, address(stakingPool), 0, txData);
            trackWithdrawal(wallet, token, amount);
        }
    }

    function claimReward(address wallet)
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        (, uint rewardWaitTime, , uint pendingReward) = stakingPool.getUserStaking(wallet);

        require(rewardWaitTime == 0 && pendingReward > 0, "UNABLE_TO_CLAIM");
        bytes memory txData = abi.encodeWithSelector(stakingPool.claim.selector);
        transactCall(wallet, address(stakingPool), 0, txData);
    }

    function tokenBalance(
        address wallet,
        address token
        )
        public
        view
        override
        returns (int balance)
    {
        if (token != lrcTokenAddress) return 0;

        (,, uint _balance, uint _reward) = stakingPool.getUserStaking(wallet);
        balance = int(_balance.add(_reward));

        require(balance >= 0, "INVALID_BALANCE");
    }

    function tokenWithdrawalable(
        address wallet,
        address token
        )
        public
        view
        override
        returns (bool unsupported, uint withdrawalable)
    {
        if (token != lrcTokenAddress) {
            unsupported = true;
        } else {
            (uint _withdrawalWaitTime, , uint _balance,) = stakingPool.getUserStaking(wallet);
            withdrawalable = _withdrawalWaitTime == 0 ? _balance : 0;
        }
    }

    function tokenDepositable(
        address wallet,
        address token
        )
        public
        view
        override
        returns (bool unsupported, uint depositable)
    {
        if (token != lrcTokenAddress) {
            unsupported = true;
        } else {
            return super.tokenDepositable(wallet, token);
        }
    }

    /// @dev Returns an estimated interest rate.
    function tokenInterestRate (
        address /*wallet*/,
        address token,
        uint    amount,
        bool    borrow
        )
        public
        view
        override
        returns (int interestRate)
    {
        if (token != lrcTokenAddress || borrow) return 0;

        uint totalStaking = stakingPool.getTotalStaking().add(amount);
        if (totalStaking == 0) return 0;

        (,,,,,,, uint remainingReward) = feeVault.getProtocolFeeStats();
        interestRate = int(remainingReward.mul(10000) / totalStaking);

        require(interestRate >= 0, "MATH_ERROR");
    }
}
