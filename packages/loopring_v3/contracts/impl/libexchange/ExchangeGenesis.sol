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
        address _loopring3Address,
        address payable _operator
        )
        public
    {
        require(0 != _id, "INVALID_ID");
        require(address(0) != _loopring3Address, "ZERO_ADDRESS");
        require(address(0) != _operator, "ZERO_ADDRESS");

        S.id = _id;
        S.loopring = ILoopringV3(_loopring3Address);
        S.operator = _operator;

        ILoopringV3 loopring = ILoopringV3(_loopring3Address);
        S.lrcAddress = loopring.lrcAddress();
        // S.exchangeHelperAddress = loopring.exchangeHelperAddress();
        S.blockVerifierAddress = loopring.blockVerifierAddress();

        ExchangeData.Block memory genesisBlock = ExchangeData.Block(
            0x2fb632af61a9ffb71034df05d1d62e8fb6112095bd28cddf56d5f2e4b57064be,
            0x0,
            ExchangeData.BlockState.FINALIZED,
            uint32(now),
            1,
            1,
            true,
            new bytes(0)
        );
        S.blocks.push(genesisBlock);

        ExchangeData.Request memory genesisRequest = ExchangeData.Request(
            0,
            0,
            0xFFFFFFFF
        );
        S.depositChain.push(genesisRequest);
        S.withdrawalChain.push(genesisRequest);

        // This account is used for padding deposits and onchain withdrawal requests so this might
        // be a bit confusing otherwise.  Because the private key is known by anyone it can also
        // be used to create dummy offhcain withdrawals/dummy orders to fill blocks when needed.
        // Because this account is all zeros it is also the most gas efficient one to use in terms
        // of calldata.

        ExchangeData.Account memory defaultAccount = ExchangeData.Account(
            address(0),
            ExchangeData.DEFAULT_ACCOUNT_PUBLICKEY_X(),
            ExchangeData.DEFAULT_ACCOUNT_PUBLICKEY_Y()
        );

        S.accounts.push(defaultAccount);

        // emit AccountUpdated(
        //     address(0),
        //     uint24(0),
        //     DEFAULT_ACCOUNT_PUBLICKEY_X,
        //     DEFAULT_ACCOUNT_PUBLICKEY_Y
        // );

        // Call these after the main state has been set up
        S.registerToken(address(0));
        S.registerToken(loopring.wethAddress());
        S.registerToken(S.lrcAddress);
    }
}