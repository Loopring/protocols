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
import "../iface/ILoopringV3.sol";

import "./exchange2/ExchangeData.sol";
import "./exchange2/ExchangeMode.sol";
import "./exchange2/ExchangeAccounts.sol";
import "./exchange2/ExchangeTokens.sol";
import "./exchange2/ExchangeBlocks.sol";
import "./exchange2/ExchangeDeposits.sol";
import "./exchange2/ExchangeWithdrawals.sol";


/// @title An Implementation of IExchange.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>

/// Inheritance: IManagingBlocks -> IManagingAccounts -> IManagingTokens -> IManagingDeposits ->
/// IManagingWithdrawals -> IManagingStakes -> IManagingOperations
contract Exchange2
{
    using ExchangeMode          for ExchangeData.State;
    using ExchangeAccounts      for ExchangeData.State;
    using ExchangeTokens        for ExchangeData.State;
    using ExchangeBlocks        for ExchangeData.State;
    using ExchangeDeposits      for ExchangeData.State;
    using ExchangeWithdrawals   for ExchangeData.State;

    ExchangeData.State public state;
    ILoopringV3 private loopring;

    // -- Mode --
    function isInWithdrawalMode()
        external
        view
        returns (bool result)
    {
        result = state.isInWithdrawalMode();
    }

    // -- Accounts --
    function getAccount(
        address owner
        )
        external
        view
        returns (
            uint24 accountID,
            uint   pubKeyX,
            uint   pubKeyY
        )
    {
       (accountID, pubKeyX, pubKeyY) = state.getAccount(owner);
    }

    function createOrUpdateAccount(
        uint pubKeyX,
        uint pubKeyY
        )
        external
        payable
        returns (uint24 accountID)
    {
        accountID = state.createOrUpdateAccount(pubKeyX, pubKeyY);
    }

    // -- Tokens --
    function registerToken(
        address tokenAddress
        )
        external
        returns (uint16 tokenID)
    {
       tokenID = state.registerToken(tokenAddress);
    }

    function getTokenID(
        address tokenAddress
        )
        external
        view
        returns (uint16 tokenID)
    {
        tokenID = state.getTokenID(tokenAddress);
    }

    function getTokenAddress(
        uint16 tokenID
        )
        external
        view
        returns (address tokenAddress)
    {
        tokenAddress = state.getTokenAddress(tokenID);
    }

    function disableTokenDeposit(
        address tokenAddress
        )
        external
    {
       state.disableTokenDeposit(tokenAddress);
    }

    function enableTokenDeposit(
        address tokenAddress
        )
        external
    {
        state.enableTokenDeposit(tokenAddress);
    }

    // -- Stakes --
    function getStake()
        external
        view
        returns (uint)
    {
        return loopring.getStake(state.id);
    }

    // -- Blocks --
    function getBlockHeight()
        external
        view
        returns (uint)
    {
        return state.blocks.length - 1;
    }

    function commitBlock(
        uint  blockType,
        bytes calldata data
        )
        external
    {
        state.commitBlock(blockType, data);
    }

    function verifyBlock(
        uint blockIdx,
        uint256[8] calldata proof
        )
        external
    {
        state.verifyBlock(blockIdx, proof);
    }

    function revertBlock(
        uint32 blockIdx
        )
        external
    {
        state.revertBlock(blockIdx);
    }

    // -- Deposits --
   function getFirstUnprocessedDepositRequestIndex()
        external
        view
        returns (uint)
    {
        return state.getFirstUnprocessedDepositRequestIndex();
    }

    function getNumAvailableDepositSlots()
        external
        view
        returns (uint)
    {
        // TODO
        return 1024;
    }

    function getDepositRequest(
        uint index
        )
        external
        view
        returns (
          bytes32 accumulatedHash,
          uint256 accumulatedFee,
          uint32  timestamp
        )
    {
        (accumulatedHash, accumulatedFee, timestamp) = state.getDepositRequest(index);
    }

    function deposit(
        uint    pubKeyX,
        uint    pubKeyY,
        address token,
        uint96  amount
        )
        external
        returns (uint24 accountID)
    {
        accountID = state.createOrUpdateAccount(pubKeyX, pubKeyY);
        state.depositTo(msg.sender, token, amount);
    }

    function deposit(
        address token,
        uint96  amount
        )
        external
    {
        state.depositTo(msg.sender, token, amount);
    }

    function depositTo(
        address recipient,
        address tokenAddress,
        uint96  amount
        )
        external
    {
        state.depositTo(recipient, tokenAddress, amount);
    }
    // constructor(
    //     uint    _id,
    //     address _loopringAddress,
    //     address _owner,
    //     address payable _operator
    //     )
    //     public
    // {
    //     require(0 != _id, "INVALID_ID");
    //     require(address(0) != _loopringAddress, "ZERO_ADDRESS");
    //     require(address(0) != _owner, "ZERO_ADDRESS");
    //     require(address(0) != _operator, "ZERO_ADDRESS");

    //     id = _id;
    //     loopringAddress = _loopringAddress;
    //     owner = _owner;
    //     operator = _operator;

    //     loopring = ILoopringV3(loopringAddress);

    //     lrcAddress = loopring.lrcAddress();
    //     exchangeHelperAddress = loopring.exchangeHelperAddress();
    //     blockVerifierAddress = loopring.blockVerifierAddress();

    //     registerToken(address(0));
    //     registerToken(loopring.wethAddress());
    //     registerToken(lrcAddress);

    //     Block memory genesisBlock = Block(
    //         0x2fb632af61a9ffb71034df05d1d62e8fb6112095bd28cddf56d5f2e4b57064be,
    //         0x0,
    //         BlockState.FINALIZED,
    //         uint32(now),
    //         1,
    //         1,
    //         true,
    //         new bytes(0)
    //     );
    //     blocks.push(genesisBlock);

    //     Request memory genesisRequest = Request(
    //         0,
    //         0,
    //         0xFFFFFFFF
    //     );
    //     depositChain.push(genesisRequest);
    //     withdrawalChain.push(genesisRequest);

    //     // This account is used for padding deposits and onchain withdrawal requests so this might
    //     // be a bit confusing otherwise.  Because the private key is known by anyone it can also
    //     // be used to create dummy offhcain withdrawals/dummy orders to fill blocks when needed.
    //     // Because this account is all zeros it is also the most gas efficient one to use in terms
    //     // of calldata.

    //     Account memory defaultAccount = Account(
    //         address(0),
    //         DEFAULT_ACCOUNT_PUBLICKEY_X,
    //         DEFAULT_ACCOUNT_PUBLICKEY_Y
    //     );

    //     accounts.push(defaultAccount);

    //     emit AccountUpdated(
    //         address(0),
    //         uint24(0),
    //         DEFAULT_ACCOUNT_PUBLICKEY_X,
    //         DEFAULT_ACCOUNT_PUBLICKEY_Y
    //     );
    // }
}