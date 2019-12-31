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

import "../../iface/exchangev3/IExchangeV3Base.sol";
import "../libexchange/ExchangeStatus.sol";
import "../libexchange/ExchangeTokens.sol";

import "./ExchangeV3Core.sol";


/// @title IExchangeV3Base
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ExchangeV3Base is IExchangeV3Base, ExchangeV3Core
{
    using ExchangeStatus    for ExchangeData.State;
    using ExchangeTokens    for ExchangeData.State;

    function initialize(
        address _loopringAddress,
        address _owner,
        uint    _id,
        address payable _operator,
        bool    _onchainDataAvailability
        )
        external
        nonReentrant
        onlyWhenUninitialized
    {
        require(address(0) != _owner, "ZERO_ADDRESS");
        require(0 != _id, "INVALID_ID");
        require(address(0) != _loopringAddress, "ZERO_ADDRESS");
        require(address(0) != _operator, "ZERO_ADDRESS");
        require(genesisBlockHash != 0, "ZERO_GENESIS_BLOCK_HASH");
        require(state.id == 0, "INITIALIZED_ALREADY");

        owner = _owner;
        state.id = _id;
        state.exchangeCreationTimestamp = now;
        state.loopring = ILoopringV3(_loopringAddress);
        state.operator = _operator;
        state.onchainDataAvailability = _onchainDataAvailability;

        ILoopringV3 loopring = ILoopringV3(_loopringAddress);
        state.lrcAddress = loopring.lrcAddress();

        ExchangeData.Block memory genesisBlock = ExchangeData.Block(
            genesisBlockHash,
            0x0,
            ExchangeData.BlockState.VERIFIED,
            IExchangeModule(0),
            0,
            0,
            uint32(now),
            uint32(block.number)
        );
        state.blocks.push(genesisBlock);
        state.numBlocksFinalized = 1;

        // Create an account for the protocol fees. This account is also used
        // for padding deposits and on-chain withdrawal requests.
        ExchangeData.Account memory protocolFeePoolAccount = ExchangeData.Account(
            address(0),
            uint24(0),
            uint(0),
            uint(0)
        );

        state.accounts.push(protocolFeePoolAccount);
        state.ownerToAccountId[protocolFeePoolAccount.owner] = uint24(state.accounts.length);

        // Call these after the main state has been set up
        state.registerToken(address(0), 0);
        state.registerToken(loopring.wethAddress(), 0);
        state.registerToken(state.lrcAddress, 0);
    }

    function shutdown()
        external
        nonReentrant
        onlyOwner
        returns (bool success)
    {
        require(!state.isInWithdrawalMode(), "INVALID_MODE");
        require(!state.isShutdown(), "ALREADY_SHUTDOWN");
        state.shutdownStartTime = now;
        emit Shutdown(state.shutdownStartTime);
        return true;
    }

    function setOperator(
        address payable _operator
        )
        external
        nonReentrant
        onlyOwner
        returns (address payable oldOperator)
    {
        require(!state.isInWithdrawalMode(), "INVALID_MODE");
        require(address(0) != _operator, "ZERO_ADDRESS");
        oldOperator = state.operator;
        state.operator = _operator;

        emit OperatorChanged(
            state.id,
            oldOperator,
            _operator
        );
    }

    function getOperator()
        external
        view
        returns (address)
    {
        return state.operator;
    }

    function areUserRequestsEnabled()
        external
        returns (bool)
    {
        return state.areUserRequestsEnabled();
    }

    function isInWithdrawalMode()
        external
        returns (bool)
    {
        return state.isInWithdrawalMode();
    }

    function isShutdown()
        external
        view
        returns (bool)
    {
        return state.isShutdown();
    }

    function isInMaintenance()
        external
        view
        returns (bool)
    {
        return state.isInMaintenance();
    }

    function getProtocol()
        external
        view
        returns (ILoopringV3)
    {
        return state.loopring;
    }

    function getId()
        external
        view
        returns (uint)
    {
        return state.id;
    }

    function hasOnchainDataAvailability()
        external
        view
        returns (bool)
    {
        return state.onchainDataAvailability;
    }

    function getExchangeCreationTimestamp()
        external
        view
        returns (uint)
    {
        return state.exchangeCreationTimestamp;
    }
}