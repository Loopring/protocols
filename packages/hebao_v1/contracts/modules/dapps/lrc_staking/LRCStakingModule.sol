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
pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "../../../base/BaseSubAccount.sol";

import "../../../lib/ERC20.sol";
import "../../../lib/MathUint.sol";

import "../../security/SecurityModule.sol";

import "./IUserStakingPool.sol";
import "./IProtocolFeeVault.sol";


/// @title LRCStakingModule
contract LRCStakingModule is BaseSubAccount, SecurityModule
{
    using MathUint for uint;

    IUserStakingPool  public stakingPool;
    IProtocolFeeVault public feeVault;

    address public lrcTokenAddress;

    constructor(
        Controller       _controller,
        IUserStakingPool _stakingPool,
        address          _lrcTokenAddress
        )
        public
        SecurityModule(_controller)
    {
        stakingPool = _stakingPool;
        feeVault = IProtocolFeeVault(stakingPool.protocolFeeVaultAddress());
        lrcTokenAddress = _lrcTokenAddress;
    }

    function deposit(
        address            wallet,
        address[] calldata signers,
        address            token,
        uint               amount
        )
        external
    {

    }

    function withdraw(
        address            wallet,
        address[] calldata signers,
        address            token,
        uint               amount
        )
        external
    {

    }

    function tokenBalance(
        address wallet,
        address token
        )
        public
        view
        returns (int balance)
    {
        if (token != lrcTokenAddress) return 0;

        uint _balance;
        uint _reward;
        (,, _balance, _reward) = stakingPool.getUserStaking(wallet);
        _balance = _balance.add(_reward);
        balance = int(_balance);
        require(balance >= 0);
    }

    function tokenWithdrawalable(
        address wallet,
        address token
        )
        public
        view
        returns (uint withdrawalable)
    {
        if (token != lrcTokenAddress) return 0;

        uint _withdrawalWaitTime;
        uint _balance;
        (_withdrawalWaitTime,, _balance, ) = stakingPool.getUserStaking(wallet);

        return _withdrawalWaitTime == 0 ? _balance : 0;
    }

    function tokenDepositable(
        address wallet,
        address token
        )
        public
        view
        returns (uint depositable)
    {
        if (token != lrcTokenAddress) return 0;
        else return super.tokenDepositable(wallet, token);
    }
}
