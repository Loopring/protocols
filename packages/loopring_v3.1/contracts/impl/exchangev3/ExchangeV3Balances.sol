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

import "../../iface/exchangev3/IExchangeV3Balances.sol";
import "../libexchange/ExchangeBalances.sol";

import "./ExchangeV3Core.sol";


/// @title ExchangeV3Balances
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ExchangeV3Balances is IExchangeV3Balances, ExchangeV3Core
{
    using ExchangeBalances      for ExchangeData.State;

    function deposit(
        address from,
        uint16  tokenID,
        uint    amount
        )
        external
        onlyModule
        payable
    {
        return state.deposit(from, tokenID, amount);
    }

    function withdraw(
        uint24  accountID,
        uint16  tokenID,
        uint    amount,
        bool    allowFailure,
        uint    gasLimit
        )
        external
        onlyModule
        returns (bool success)
    {
        return state.withdraw(accountID, tokenID, amount, allowFailure, gasLimit);
    }

    function isAccountBalanceCorrect(
        uint     merkleRoot,
        uint24   accountID,
        uint16   tokenID,
        uint     pubKeyX,
        uint     pubKeyY,
        uint32   nonce,
        uint96   balance,
        uint     tradeHistoryRoot,
        uint[30] calldata accountPath,
        uint[12] calldata balancePath
        )
        external
        pure
        returns (bool)
    {
        return ExchangeBalances.isAccountBalanceCorrect(
            merkleRoot,
            accountID,
            tokenID,
            pubKeyX,
            pubKeyY,
            nonce,
            balance,
            tradeHistoryRoot,
            accountPath,
            balancePath
        );
    }

    function withdrawFromMerkleTree(
        address  token,
        uint     pubKeyX,
        uint     pubKeyY,
        uint32   nonce,
        uint96   balance,
        uint     tradeHistoryRoot,
        uint[30] calldata accountPath,
        uint[12] calldata balancePath
        )
        external
        nonReentrant
    {
        state.withdrawFromMerkleTreeFor(
            msg.sender,
            token,
            pubKeyX,
            pubKeyY,
            nonce,
            balance,
            tradeHistoryRoot,
            accountPath,
            balancePath
        );
    }

    // We still alow anyone to withdraw these funds for the account owner
    function withdrawFromMerkleTreeFor(
        address  owner,
        address  token,
        uint     pubKeyX,
        uint     pubKeyY,
        uint32   nonce,
        uint96   balance,
        uint     tradeHistoryRoot,
        uint[30] calldata accountPath,
        uint[12] calldata balancePath
        )
        external
        nonReentrant
    {
        state.withdrawFromMerkleTreeFor(
            owner,
            token,
            pubKeyX,
            pubKeyY,
            nonce,
            balance,
            tradeHistoryRoot,
            accountPath,
            balancePath
        );
    }

    function withdrawTokenNotOwnedByUsers(
        address tokenAddress,
        address payable recipient
        )
        external
        nonReentrant
        onlyOwner
        returns(uint)
    {
        return state.withdrawTokenNotOwnedByUsers(tokenAddress, recipient);
    }

    function onchainTransferFrom(
        address token,
        address from,
        address to,
        uint    amount
        )
        external
        nonReentrant
        onlyModule
    {
        return state.onchainTransferFrom(
            token,
            from,
            to,
            amount
        );
    }
}