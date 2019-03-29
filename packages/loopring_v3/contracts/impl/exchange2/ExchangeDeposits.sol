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

import "../../lib/BurnableERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";

import "./ExchangeData.sol";
import "./ExchangeMode.sol";
import "./ExchangeAccounts.sol";
import "./ExchangeTokens.sol";

import "../../iface/ILoopringV3.sol";

/// @title ExchangeAccounts.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeDeposits
{
    using MathUint          for uint;
    using ERC20SafeTransfer for address;
    using ExchangeMode      for ExchangeData.State;
    using ExchangeAccounts  for ExchangeData.State;
    using ExchangeTokens    for ExchangeData.State;

    event DepositRequested(
        uint32 depositIdx,
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
    );

    function getFirstUnprocessedDepositRequestIndex(
        ExchangeData.State storage S
      )
        public
        view
        returns (uint)
    {
        ExchangeData.Block storage currentBlock = S.blocks[S.blocks.length - 1];
        return currentBlock.numDepositRequestsCommitted;
    }

    function getNumAvailableDepositSlots(
        ExchangeData.State storage S
        )
        public
        view
        returns (uint)
    {
        // TODO
        return 1024;
    }

    function getDepositRequest(
        ExchangeData.State storage S,
        uint index
        )
        public
        view
        returns (
          bytes32 accumulatedHash,
          uint256 accumulatedFee,
          uint32  timestamp
        )
    {
        require(index < S.depositChain.length, "INVALID_INDEX");
        ExchangeData.Request storage request = S.depositChain[index];
        accumulatedHash = request.accumulatedHash;
        accumulatedFee = request.accumulatedFee;
        timestamp = request.timestamp;
    }

    function depositTo(
        ExchangeData.State storage S,
        address recipient,
        address tokenAddress,
        uint96  amount
        )
        public
    {
        require(recipient != address(0), "ZERO_ADDRESS");
        require(amount > 0, "ZERO_VALUE");
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(now >= S.disableUserRequestsUntil, "USER_REQUEST_SUSPENDED");
        require(getNumAvailableDepositSlots(S) > 0, "TOO_MANY_REQUESTS_OPEN");

        uint16 tokenID = S.getTokenID(tokenAddress);
        ExchangeData.Token storage token = S.tokens[tokenID - 1];
        require(!token.depositDisabled, "TOKEN_DEPOSIT_DISABLED");

        uint24 accountID = S.getAccountID(recipient);
        ExchangeData.Account storage account = S.accounts[accountID];

        // Check ETH value sent, can be larger than the expected deposit fee
        uint feeSurplus = 0;
        if (tokenID != 0) {
            require(msg.value >= S.depositFeeETH, "INSUFFICIENT_FEE");
            feeSurplus = msg.value.sub(S.depositFeeETH);
        } else {
            require(msg.value >= (S.depositFeeETH.add(amount)), "INSUFFICIENT_FEE");
            feeSurplus = msg.value.sub(S.depositFeeETH.add(amount));
        }
        // Send surplus of ETH back to the sender
        if (feeSurplus > 0) {
            msg.sender.transfer(feeSurplus);
        }

        // Add the request to the deposit chain
        ExchangeData.Request storage prevRequest = S.depositChain[S.depositChain.length - 1];
        ExchangeData.Request memory request = ExchangeData.Request(
            sha256(
                abi.encodePacked(
                    prevRequest.accumulatedHash,
                    accountID,
                    account.pubKeyX,
                    account.pubKeyY,
                    tokenID,
                    amount
                )
            ),
            prevRequest.accumulatedFee.add(S.depositFeeETH),
            uint32(now)
        );
        S.depositChain.push(request);

        // Transfer the tokens from the owner into this contract
        if (tokenID != 0) {
            require(
                tokenAddress.safeTransferFrom(
                    account.owner,
                    address(this),
                    amount
                ),
                "INSUFFICIENT_FUND"
            );
        }

        // Store deposit info onchain so we can withdraw from uncommitted deposit blocks
        ExchangeData.Deposit memory _deposit = ExchangeData.Deposit(
            accountID,
            tokenID,
            amount
        );
        S.deposits.push(_deposit);

        emit DepositRequested(
            uint32(S.depositChain.length - 1),
            accountID,
            tokenID,
            amount
        );
    }
}