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

import "../iface/IExchange.sol";

import "./exchange/ManagingOperations.sol";


/// @title An Implementation of IExchange.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>

/// Inheritance: IManagingBlocks -> IManagingAccounts -> IManagingTokens -> IManagingDeposits ->
/// IManagingWithdrawals -> IManagingStakes -> IManagingOperations
contract Exchange is IExchange, ManagingOperations
{
    constructor(
        uint    _id,
        address _loopringAddress,
        address _owner,
        address payable _operator
        )
        public
    {
        require(0 != _id, "INVALID_ID");
        require(address(0) != _loopringAddress, "ZERO_ADDRESS");
        require(address(0) != _owner, "ZERO_ADDRESS");
        require(address(0) != _operator, "ZERO_ADDRESS");

        id = _id;
        loopringAddress = _loopringAddress;
        owner = _owner;
        operator = _operator;

        loopring = ILoopringV3(loopringAddress);

        lrcAddress = loopring.lrcAddress();
        exchangeHelperAddress = loopring.exchangeHelperAddress();
        blockVerifierAddress = loopring.blockVerifierAddress();

        registerToken(address(0));
        registerToken(loopring.wethAddress());
        registerToken(lrcAddress);

        Block memory genesisBlock = Block(
            0x052a665459ab63c26cccff7e4f5b70727ecda24f2d398695fc3943e62b4b1901,
            0x0,
            BlockState.FINALIZED,
            uint32(now),
            1,
            1,
            true,
            new bytes(0)
        );
        blocks.push(genesisBlock);

        Request memory genesisRequest = Request(
            0,
            0,
            0xFFFFFFFF
        );
        depositChain.push(genesisRequest);
        withdrawalChain.push(genesisRequest);

        // TODO(brecht): why we need this?
        // Reserve default account slot at accountID 0
        Account memory defaultAccount = Account(
            address(0),
            DEFAULT_ACCOUNT_PUBLICKEY_X,
            DEFAULT_ACCOUNT_PUBLICKEY_Y
        );

        accounts.push(defaultAccount);
        ownerToAccountId[address(0)] = 0;

        emit AccountUpdated(
            address(0),
            uint24(0),
            DEFAULT_ACCOUNT_PUBLICKEY_X,
            DEFAULT_ACCOUNT_PUBLICKEY_Y
        );
    }
}