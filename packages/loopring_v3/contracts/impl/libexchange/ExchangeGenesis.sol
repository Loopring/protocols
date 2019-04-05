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
pragma solidity 0.5.2;

import "../../lib/MathUint.sol";

import "../../iface/IBlockVerifier.sol";
import "../../iface/ILoopringV3.sol";

import "./ExchangeAccounts.sol";
import "./ExchangeData.sol";
import "./ExchangeTokens.sol";


/// @title IManagingMode.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeGenesis
{
    using ExchangeAccounts  for ExchangeData.State;
    using ExchangeTokens    for ExchangeData.State;

    function initializeGenesisBlock(
        ExchangeData.State storage S,
        uint    _id,
        address payable _loopringAddress,
        address payable _operator,
        bool    _onchainDataAvailability
        )
        public
    {
        require(0 != _id, "INVALID_ID");
        require(address(0) != _loopringAddress, "ZERO_ADDRESS");
        require(address(0) != _operator, "ZERO_ADDRESS");

        S.id = _id;
        S.loopring = ILoopringV3(_loopringAddress);
        S.operator = _operator;
        S.onchainDataAvailability = _onchainDataAvailability;

        ILoopringV3 loopring = ILoopringV3(_loopringAddress);
        S.blockVerifier = IBlockVerifier(loopring.blockVerifierAddress());
        S.lrcAddress = loopring.lrcAddress();

        ExchangeData.Block memory genesisBlock = ExchangeData.Block(
            0x035cfa8f3dc9086ce9e24bc8b49d757b03fb830ee2902084e213849b05dd708f,
            0x0,
            ExchangeData.BlockState.FINALIZED,
            0xFF,
            0,
            uint32(now),
            1,
            1,
            true,
            0,
            new bytes(0)
        );
        S.blocks.push(genesisBlock);
        S.numBlocksFinalized = 1;

        ExchangeData.Request memory genesisRequest = ExchangeData.Request(
            0,
            0,
            0xFFFFFFFF
        );
        S.depositChain.push(genesisRequest);
        S.withdrawalChain.push(genesisRequest);

        // This account is used for padding deposits and onchain withdrawal requests. While we do
        // do not necessarily need a special account for this (we could use the data of the first account
        // to do the padding) it's easier and more efficient if this data remains the same.
        // The account owner of account ID 0 would also see many deposit/withdrawal events for his account
        // that should simply be ignored.
        ExchangeData.Account memory defaultAccount = ExchangeData.Account(
            address(0),
            uint256(0),
            uint256(0)
        );

        S.accounts.push(defaultAccount);

        // Call these after the main state has been set up
        S.registerToken(address(0), 0);
        S.registerToken(loopring.wethAddress(), 0);
        S.registerToken(S.lrcAddress, 0);
    }
}