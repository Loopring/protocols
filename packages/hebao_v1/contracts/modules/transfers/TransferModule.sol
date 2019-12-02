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

import "../../lib/ERC20.sol";

import "../../base/BaseSubAccount.sol";

import "../security/SecurityModule.sol";


/// @title TransferModule
contract TransferModule is BaseSubAccount, SecurityModule
{
    event MainAccountTransfer(
        address indexed wallet,
        address indexed token,
        address indexed to,
        uint            amount,
        bytes           logdata
    );

    event Approved(
        address indexed wallet,
        address indexed token,
        address         to,
        uint            amount
    );
    event ContractCalled(
        address indexed wallet,
        address indexed to,
        uint            amount,
        bytes           data
    );

    constructor(
        SecurityStore _securityStore
        )
        public
        SecurityModule(_securityStore)
    {
    }

    function subAccountName()
        public
        pure
        returns (string memory)
    {
        return "main";
    }

    function boundMethods()
        public
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](2);
        methods[0] = this.tokenBalance.selector;
        methods[1] = this.tokenBalances.selector;
    }

    function tokenBalance(
        address wallet,
        address token
        )
        public
        view
        returns (int balance)
    {
        if (token == address(0)) {
            balance = int(wallet.balance);
        } else {
            balance = int(ERC20(token).balanceOf(wallet));
        }

        require(balance >=0, "INVALID_BALANCE");
    }

    function tokenBalances(
        address   wallet,
        address[] memory tokens
        )
        public
        view
        returns (int[] memory balances)
    {
        balances = new int[](tokens.length);
        for (uint i = 0; i < tokens.length; i++) {
            balances[i] = tokenBalance(wallet, tokens[i]);
        }
    }

    // TODO(daniel): no-reentrance
    function onReceiveToken(
        address payable wallet,
        address token,
        address sourceSubAccount,
        uint amount
        )
        external
    {
        if (token == address(0)) {
            wallet.transfer(amount);
        } else {
            require(
                ERC20(token).transferFrom(address(this), wallet, amount),
                "TOKEN_TRANSFER_FAILED"
            );
        }
    }

    function transferFromWallet(
        address wallet,
        address token,
        address to,
        uint    amount,
        bytes   memory logdata
        )
        internal
    {
        if (amount == 0) return;

        if (token == address(0)) {
            transactCall(wallet, to, amount, "");
        } else {
            bytes memory txData = abi.encodeWithSelector(
                ERC20(token).transfer.selector,
                to,
                amount
            );
            transactCall(wallet, token, 0, txData);
        }
        emit MainAccountTransfer(wallet, token, to, amount, logdata);
    }

    function approveInternal(
        address wallet,
        address token,
        address to,
        uint    amount
        )
        internal
    {
        require(token != address(0), "UNSUPPORTED");

        bytes memory txData = abi.encodeWithSelector(
            ERC20(token).approve.selector,
            to,
            amount
        );
        transactCall(wallet, token, 0, txData);
        emit Approved(wallet, token, to, amount);
    }

    function callContractInternal(
        address wallet,
        address to,
        uint    amount,
        bytes   memory txData
        )
        internal
    {
        bytes4 method = extractMethod(txData);
        require(method != ERC20_TRANSFER && method != ERC20_APPROVE, "INVALID_METHOD");

        transactCall(wallet, to, amount, txData);
        emit ContractCalled(wallet, to, amount, txData);
    }
}
