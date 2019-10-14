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

import "../libexchange/ExchangeAccounts.sol";
import "../libexchange/ExchangeData.sol";
import "../libexchange/ExchangeStatus.sol";
import "../libexchange/ExchangeTokens.sol";

import "../../lib/AddressUtil.sol";
import "../../lib/MathUint.sol";
import "../../lib/Poseidon.sol";


/// @title ExchangeBalances.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeBalances
{
    using MathUint  for uint;

    using AddressUtil       for address;
    using AddressUtil       for address payable;
    using MathUint          for uint;
    using ERC20SafeTransfer for address;
    using ExchangeAccounts  for ExchangeData.State;
    using ExchangeBalances  for ExchangeData.State;
    using ExchangeStatus    for ExchangeData.State;
    using ExchangeTokens    for ExchangeData.State;

    event WithdrawalCompleted(
        uint24  indexed accountID,
        uint16  indexed tokenID,
        address         to,
        uint96          amount
    );

    event WithdrawalFailed(
        uint24  indexed accountID,
        uint16  indexed tokenID,
        address         to,
        uint96          amount
    );

    function deposit(
        ExchangeData.State storage state,
        address from,
        uint16 tokenID,
        uint   amount
        )
        external
    {
        if (amount > 0) {
            address tokenAddress = state.getTokenAddress(tokenID);
            if (tokenAddress != address(0)) {
                tokenAddress.safeTransferFromAndVerify(from, address(this), amount);
            } else {
                require(msg.value == amount, "INCORRECT_ETH_DEPOSIT");
            }
            // Keep track how many tokens are deposited in the exchange
            state.tokenBalances[tokenAddress] = state.tokenBalances[tokenAddress].add(amount);
            // Limit the total token balance to MAX_TOKEN_BALANCE.
            // This way we can never have overflows when depositing, so users can never lose any funds this way.
            require(
                state.tokenBalances[tokenAddress] <= ExchangeData.MAX_TOKEN_BALANCE(),
                "TOKEN_BALANCE_TOO_HIGH"
            );
        }
    }

    function withdraw(
        ExchangeData.State storage state,
        uint24  accountID,
        uint16  tokenID,
        uint    amount,
        bool    allowFailure,
        uint    gasLimit
        )
        public
        returns (bool success)
    {
        // If we're withdrawing from the protocol fee account send the tokens
        // directly to the protocol fee vault.
        // If we're withdrawing to an unknown account (can currently happen while
        // distributing tokens in shutdown) send the tokens to the protocol fee vault as well.
        address to;
        if (accountID == 0 || accountID >= state.accounts.length) {
            to = state.loopring.protocolFeeVault();
        } else {
            to = state.accounts[accountID].owner;
        }

        address tokenAddress = state.getTokenAddress(tokenID);

        // Transfer the tokens from the contract to the owner
        if (amount > 0) {
            if (tokenAddress == address(0)) {
                // ETH
                success = to.sendETH(amount, gasLimit);
            } else {
                // ERC20 token
                success = tokenAddress.safeTransferWithGasLimit(to, amount, gasLimit);
            }
        } else {
            success = true;
        }

        if (!allowFailure) {
            require(success, "TRANSFER_FAILURE");
        }

        if (success) {
            if (amount > 0) {
                state.tokenBalances[tokenAddress] = state.tokenBalances[tokenAddress].sub(amount);
            }

            if (accountID > 0 || tokenID > 0 || amount > 0) {
                // Only emit an event when the withdrawal data hasn't been reset yet
                // by a previous successful withdrawal
                emit WithdrawalCompleted(
                    accountID,
                    tokenID,
                    to,
                    uint96(amount)
                );
            }
        } else {
            emit WithdrawalFailed(
                accountID,
                tokenID,
                to,
                uint96(amount)
            );
        }
    }

    function verifyAccountBalance(
        uint     merkleRoot,
        uint24   accountID,
        uint16   tokenID,
        uint     pubKeyX,
        uint     pubKeyY,
        uint32   nonce,
        uint96   balance,
        uint     tradeHistoryRoot,
        uint[30] memory accountMerkleProof,
        uint[12] memory balanceMerkleProof
        )
        public
        pure
    {
        bool isCorrect = isAccountBalanceCorrect(
            merkleRoot,
            accountID,
            tokenID,
            pubKeyX,
            pubKeyY,
            nonce,
            balance,
            tradeHistoryRoot,
            accountMerkleProof,
            balanceMerkleProof
        );
        require(isCorrect, "INVALID_MERKLE_TREE_DATA");
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
        uint[30] memory accountMerkleProof,
        uint[12] memory balanceMerkleProof
        )
        public
        pure
        returns (bool isCorrect)
    {
        // Verify data
        uint calculatedRoot = getBalancesRoot(
            tokenID,
            balance,
            tradeHistoryRoot,
            balanceMerkleProof
        );
        calculatedRoot = getAccountInternalsRoot(
            accountID,
            pubKeyX,
            pubKeyY,
            nonce,
            calculatedRoot,
            accountMerkleProof
        );
        isCorrect = (calculatedRoot == merkleRoot);
    }

    // We still alow anyone to withdraw these funds for the account owner
    function withdrawFromMerkleTreeFor(
        ExchangeData.State storage S,
        address  owner,
        address  token,
        uint     pubKeyX,
        uint     pubKeyY,
        uint32   nonce,
        uint96   balance,
        uint     tradeHistoryRoot,
        uint[30] calldata accountMerkleProof,
        uint[12] calldata balanceMerkleProof
        )
        external
    {
        require(S.isInWithdrawalMode(), "NOT_IN_WITHDRAW_MODE");

        ExchangeData.Block storage lastFinalizedBlock = S.blocks[S.numBlocksFinalized - 1];

        uint24 accountID = S.getAccountID(owner);
        uint16 tokenID = S.getTokenID(token);
        require(S.withdrawnInWithdrawMode[owner][token] == false, "WITHDRAWN_ALREADY");

        verifyAccountBalance(
            uint(lastFinalizedBlock.merkleRoot),
            accountID,
            tokenID,
            pubKeyX,
            pubKeyY,
            nonce,
            balance,
            tradeHistoryRoot,
            accountMerkleProof,
            balanceMerkleProof
        );

        // Make sure the balance can only be withdrawn once
        S.withdrawnInWithdrawMode[owner][token] = true;

        // Transfer the tokens
        withdraw(
            S,
            accountID,
            tokenID,
            balance,
            false,
            gasleft()
        );
    }

    function withdrawTokenNotOwnedByUsers(
        ExchangeData.State storage S,
        address token,
        address payable recipient
        )
        external
        returns (uint amount)
    {
        require(token != address(0), "ZERO_ADDRESS");
        require(recipient != address(0), "ZERO_VALUE");

        uint totalBalance = ERC20(token).balanceOf(address(this));
        uint userBalance = S.tokenBalances[token];

        assert(totalBalance >= userBalance);
        amount = totalBalance - userBalance;

        if (amount > 0) {
            token.safeTransferAndVerify(recipient, amount);
        }
    }

    function onchainTransferFrom(
        ExchangeData.State storage /*S*/,
        address token,
        address from,
        address to,
        uint    amount
        )
        external
    {
        token.safeTransferFromAndVerify(from, to, amount);
    }

    function getBalancesRoot(
        uint16   tokenID,
        uint     balance,
        uint     tradeHistoryRoot,
        uint[12] memory balanceMerkleProof
        )
        private
        pure
        returns (uint)
    {
        uint balanceItem = hashImpl(balance, tradeHistoryRoot, 0, 0);
        uint _id = tokenID;
        for (uint depth = 0; depth < 4; depth++) {
            if (_id & 3 == 0) {
                balanceItem = hashImpl(
                    balanceItem,
                    balanceMerkleProof[depth * 3],
                    balanceMerkleProof[depth * 3 + 1],
                    balanceMerkleProof[depth * 3 + 2]
                );
            } else if (_id & 3 == 1) {
                balanceItem = hashImpl(
                    balanceMerkleProof[depth * 3],
                    balanceItem,
                    balanceMerkleProof[depth * 3 + 1],
                    balanceMerkleProof[depth * 3 + 2]
                );
            } else if (_id & 3 == 2) {
                balanceItem = hashImpl(
                    balanceMerkleProof[depth * 3],
                    balanceMerkleProof[depth * 3 + 1],
                    balanceItem,
                    balanceMerkleProof[depth * 3 + 2]
                );
            } else if (_id & 3 == 3) {
                balanceItem = hashImpl(
                    balanceMerkleProof[depth * 3],
                    balanceMerkleProof[depth * 3 + 1],
                    balanceMerkleProof[depth * 3 + 2],
                    balanceItem
                );
            }
            _id = _id >> 2;
        }
        return balanceItem;
    }

    function getAccountInternalsRoot(
        uint24   accountID,
        uint     pubKeyX,
        uint     pubKeyY,
        uint     nonce,
        uint     balancesRoot,
        uint[30] memory accountMerkleProof
        )
        private
        pure
        returns (uint)
    {
        uint accountItem = hashImpl(pubKeyX, pubKeyY, nonce, balancesRoot);
        uint _id = accountID;
        for (uint depth = 0; depth < 10; depth++) {
            if (_id & 3 == 0) {
                accountItem = hashImpl(
                    accountItem,
                    accountMerkleProof[depth * 3],
                    accountMerkleProof[depth * 3 + 1],
                    accountMerkleProof[depth * 3 + 2]
                );
            } else if (_id & 3 == 1) {
                accountItem = hashImpl(
                    accountMerkleProof[depth * 3],
                    accountItem,
                    accountMerkleProof[depth * 3 + 1],
                    accountMerkleProof[depth * 3 + 2]
                );
            } else if (_id & 3 == 2) {
                accountItem = hashImpl(
                    accountMerkleProof[depth * 3],
                    accountMerkleProof[depth * 3 + 1],
                    accountItem,
                    accountMerkleProof[depth * 3 + 2]
                );
            } else if (_id & 3 == 3) {
                accountItem = hashImpl(
                    accountMerkleProof[depth * 3],
                    accountMerkleProof[depth * 3 + 1],
                    accountMerkleProof[depth * 3 + 2],
                    accountItem
                );
            }
            _id = _id >> 2;
        }
        return accountItem;
    }

    function hashImpl(
        uint t0,
        uint t1,
        uint t2,
        uint t3
        )
        private
        pure
        returns (uint)
    {
        return Poseidon.hash_t5f6p52(t0, t1, t2, t3, 0);
    }
}
