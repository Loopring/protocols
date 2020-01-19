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

import "../../iface/exchangev3/IExchangeV3Staking.sol";
import "../libexchange/ExchangeStatus.sol";

import "./ExchangeV3Core.sol";


/// @title ExchangeV3Staking
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ExchangeV3Staking is IExchangeV3Staking, ExchangeV3Core
{
    using ExchangeStatus    for ExchangeData.State;

    function getExchangeStake()
        external
        view
        returns (uint)
    {
        return state.loopring.getExchangeStake(state.id);
    }

    function withdrawExchangeStake(
        address recipient
        )
        external
        nonReentrant
        onlyOwner
        returns (uint)
    {
        ExchangeData.Block storage lastBlock = state.blocks[state.blocks.length - 1];

        // Exchange needs to be shutdown
        require(state.isShutdown(), "EXCHANGE_NOT_SHUTDOWN");
        // All blocks needs to be finalized
        require(state.blocks.length == state.numBlocksFinalized, "BLOCK_NOT_FINALIZED");
        // We also require that all open requests in all modules are processed
        for(uint i = 0; i < state.modules.length; i++) {
            (, bool hasOpenRequests, ) = state.modules[i].module.getStatus();
            require(!hasOpenRequests, "REQUESTS_NOT_PROCESSED");
        }
        // Merkle root needs to be reset to the genesis block
        // (i.e. all balances 0 and all other state reset to default values)
        require(state.isInInitialState(), "MERKLE_ROOT_NOT_REVERTED");

        // Another requirement is that the last block needs to be committed
        // for at least MIN_TIME_UNTIL_EXCHANGE_STAKE_IS_WITHDRAWABLE.
        // This is to allow for other processes to complete that depend on the availability
        // of the exchange stake (e.g. the fine for not distributing the withdrawals).
        require(
            now > lastBlock.timestamp + ExchangeData.MIN_TIME_UNTIL_EXCHANGE_STAKE_IS_WITHDRAWABLE(),
            "TOO_EARLY"
        );

        // Withdraw the complete stake
        uint amount = state.loopring.getExchangeStake(state.id);
        return state.loopring.withdrawExchangeStake(state.id, recipient, amount);
    }

    function withdrawProtocolFeeStake(
        address recipient,
        uint amount
        )
        external
        nonReentrant
        onlyOwner
    {
        state.loopring.withdrawProtocolFeeStake(state.id, recipient, amount);
    }

    function burnExchangeStake()
        external
        nonReentrant
    {
        // Allow burning the complete exchange stake when the exchange gets into withdrawal mode
        if(state.isInWithdrawalMode()) {
            // Burn the complete stake of the exchange
            uint stake = state.loopring.getExchangeStake(state.id);
            state.loopring.burnExchangeStake(state.id, stake);
        }
    }

    function withdrawExchangeStake(
        address recipient,
        uint amount
        )
        external
        nonReentrant
        onlyModule
        returns (uint)
    {
        return state.loopring.withdrawExchangeStake(state.id, recipient, amount);
    }

    function burnExchangeStake(
        uint amount
        )
        external
        nonReentrant
        onlyModule
    {
        state.loopring.burnExchangeStake(state.id, amount);
    }
}