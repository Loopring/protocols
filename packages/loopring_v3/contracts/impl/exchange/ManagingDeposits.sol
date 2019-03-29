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

import "../../iface/exchange/IManagingDeposits.sol";

import "./ManagingTokens.sol";

/// @title An Implementation of IManagingDeposits.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ManagingDeposits is IManagingDeposits, ManagingTokens
{
    function getFirstUnprocessedDepositRequestIndex()
        public
        view
        returns (uint)
    {
        Block storage currentBlock = blocks[blocks.length - 1];
        return currentBlock.numDepositRequestsCommitted;
    }

    function getNumAvailableDepositSlots()
        public
        view
        returns (uint)
    {
        uint numOpenRequests = depositChain.length - getFirstUnprocessedDepositRequestIndex();
        return MAX_OPEN_REQUESTS - numOpenRequests;
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
        require(index < depositChain.length, "INVALID_INDEX");
        Request storage request = depositChain[index];
        accumulatedHash = request.accumulatedHash;
        accumulatedFee = request.accumulatedFee;
        timestamp = request.timestamp;
    }

    function updateAccountAndDeposit(
        uint    pubKeyX,
        uint    pubKeyY,
        address token,
        uint96  amount
        )
        external
        payable
        returns (uint24 accountID)
    {
        accountID = createOrUpdateAccount(pubKeyX, pubKeyY);
        depositTo(msg.sender, token, amount);
    }

    function deposit(
        address token,
        uint96  amount
        )
        external
        payable
    {
        depositTo(msg.sender, token, amount);
    }

    function depositTo(
        address recipient,
        address tokenAddress,
        uint96  amount
        )
        public
        payable
    {
        require(recipient != address(0), "ZERO_ADDRESS");
        require(!isInWithdrawalMode(), "INVALID_MODE");
        require(now >= disableUserRequestsUntil, "USER_REQUEST_SUSPENDED");
        require(getNumAvailableDepositSlots() > 0, "TOO_MANY_REQUESTS_OPEN");

        uint16 tokenID = getTokenID(tokenAddress);
        Token storage token = tokens[tokenID - 1];
        require(!token.depositDisabled, "TOKEN_DEPOSIT_DISABLED");

        uint24 accountID = getAccountID(recipient);
        Account storage account = accounts[accountID];

        // Check ETH value sent, can be larger than the expected deposit fee
        uint feeSurplus = 0;
        if (tokenAddress != address(0)) {
            require(msg.value >= depositFeeETH, "INSUFFICIENT_FEE");
            feeSurplus = msg.value.sub(depositFeeETH);
        } else {
            require(msg.value >= (depositFeeETH.add(amount)), "INSUFFICIENT_FEE");
            feeSurplus = msg.value.sub(depositFeeETH.add(amount));
        }
        // Send surplus of ETH back to the sender
        if (feeSurplus > 0) {
            msg.sender.transfer(feeSurplus);
        }

        // Add the request to the deposit chain
        Request storage prevRequest = depositChain[depositChain.length - 1];
        Request memory request = Request(
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
            prevRequest.accumulatedFee.add(depositFeeETH),
            uint32(now)
        );
        depositChain.push(request);

        // Transfer the tokens from the owner into this contract
        if (tokenAddress != address(0)) {
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
        Deposit memory _deposit = Deposit(
            accountID,
            tokenID,
            amount
        );
        deposits.push(_deposit);

        emit DepositRequested(
            uint32(depositChain.length - 1),
            accountID,
            tokenID,
            amount
        );
    }

}