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

import "../../lib/MathUint.sol";

import "../../iface/ExchangeData.sol";
import "../../iface/IBlockVerifier.sol";
import "../../iface/ILoopringV3.sol";

import "./ExchangeAccounts.sol";
import "./ExchangeTokens.sol";


/// @title ExchangeGenesis.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeGenesis
{
    using ExchangeAccounts  for ExchangeData.State;
    using ExchangeTokens    for ExchangeData.State;

    function initializeGenesisBlock(
        ExchangeData.State storage S,
        uint    _id,
        address _loopringAddress,
        address payable _operator,
        bool    _onchainDataAvailability,
        bytes32 _genesisBlockHash
        )
        external
    {
        require(0 != _id, "INVALID_ID");
        require(address(0) != _loopringAddress, "ZERO_ADDRESS");
        require(address(0) != _operator, "ZERO_ADDRESS");
        require(_genesisBlockHash != 0, "ZERO_GENESIS_BLOCK_HASH");
        require(S.id == 0, "INITIALIZED_ALREADY");

        S.id = _id;
        S.exchangeCreationTimestamp = now;
        S.loopring = ILoopringV3(_loopringAddress);
        S.operator = _operator;
        S.onchainDataAvailability = _onchainDataAvailability;
        S.genesisMerkleRoot = _genesisBlockHash;

        ILoopringV3 loopring = ILoopringV3(_loopringAddress);
        S.blockVerifier = IBlockVerifier(loopring.blockVerifierAddress());
        S.lrcAddress = loopring.lrcAddress();

        S.merkleRoot = S.genesisMerkleRoot;
        S.numBlocksSubmitted = 1;
        S.numDepositRequestsCommitted = 1;
        S.numWithdrawalRequestsCommitted = 1;

        ExchangeData.Request memory genesisRequest = ExchangeData.Request(
            0,
            0,
            0xFFFFFFFF
        );
        S.depositChain.push(genesisRequest);
        S.withdrawalChain.push(genesisRequest);

        // Create an account for the protocol fees. This account is also used
        // for padding deposits and on-chain withdrawal requests.
        ExchangeData.Account memory protocolFeePoolAccount = ExchangeData.Account(
            address(0),
            uint(0),
            uint(0)
        );

        S.accounts.push(protocolFeePoolAccount);
        S.ownerToAccountId[protocolFeePoolAccount.owner] = uint24(S.accounts.length);

        // Get the protocol fees for this exchange
        S.protocolFeeData.timestamp = uint32(0);
        S.protocolFeeData.takerFeeBips = S.loopring.maxProtocolTakerFeeBips();
        S.protocolFeeData.makerFeeBips = S.loopring.maxProtocolMakerFeeBips();
        S.protocolFeeData.previousTakerFeeBips = S.protocolFeeData.takerFeeBips;
        S.protocolFeeData.previousMakerFeeBips = S.protocolFeeData.makerFeeBips;

        // Call these after the main state has been set up
        S.registerToken(address(0), 0);
        S.registerToken(loopring.wethAddress(), 0);
        S.registerToken(S.lrcAddress, 0);
    }
}