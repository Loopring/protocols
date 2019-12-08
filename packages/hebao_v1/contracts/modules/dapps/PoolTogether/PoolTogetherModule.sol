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
pragma solidity ^0.5.13;
pragma experimental ABIEncoderV2;

import "../../../base/BaseSubAccount.sol";
import "../../security/SecurityModule.sol";

import "../../../lib/ERC20.sol";

import "./IPool.sol";


/// @title PoolTogetherModule
/// @dev https://www.pooltogether.com/
/// @author Brecht Devos - <brecht@loopring.org>
contract PoolTogetherModule is BaseSubAccount, SecurityModule
{
    IPool public pool;

    address public supportedToken;

    constructor(
        Controller       _controller,
        IPool            _pool
        )
        public
        SecurityModule(_controller)
    {
        pool = _pool;
        supportedToken = pool.cToken().underlying();
    }

    function deposit(
        address            wallet,
        address[] calldata /*signers*/,
        address            token,
        uint               amount
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        require(token == supportedToken, "UNSUPORTED_TOKEN");

        // Approve
        if (ERC20(token).allowance(wallet, address(pool)) < amount) {
            bytes memory txData = abi.encodeWithSelector(
                ERC20(token).approve.selector,
                address(pool),
                amount
            );
            transactCall(wallet, token, 0, txData);
        }

        // Deposit to the pool
        bytes memory txData = abi.encodeWithSelector(
            pool.depositPool.selector,
            amount
        );
        transactCall(wallet, address(pool), 0, txData);

        trackDeposit(wallet, token, amount);
    }

    function withdraw(
        address            wallet,
        address[] calldata /*signers*/,
        address            token,
        uint               amount
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        require(token == supportedToken, "UNSUPORTED_TOKEN");
        require(amount == tokenWithdrawable(wallet, token), "FULL_BALANCE_REQUIRED");

        // Withdraw from the pool
        bytes memory txData = abi.encodeWithSelector(
            pool.withdraw.selector
        );
        transactCall(wallet, address(pool), 0, txData);

        trackWithdrawal(wallet, token, amount);
    }

    function tokenBalance(
        address wallet,
        address token
        )
        public
        view
        returns (int balance)
    {
        if (token == supportedToken) {
            balance = int(pool.balanceOf(wallet));
            require(balance >= 0, "INVALID_BALANCE");
        } else {
            balance = 0;
        }
    }

    function tokenDepositable(
        address wallet,
        address token
        )
        public
        view
        returns (uint depositable)
    {
        if (token == supportedToken) {
            return super.tokenDepositable(wallet, token);
        } else {
            return 0;
        }
    }

    function extractMetaTxSigners(
        address wallet,
        bytes4  method,
        bytes   memory /*data*/
        )
        internal
        view
        returns (address[] memory signers)
    {
        require (
            method == this.deposit.selector ||
            method == this.withdraw.selector,
            "INVALID_METHOD"
        );

        signers = new address[](1);
        signers[0] = Wallet(wallet).owner();
    }
}