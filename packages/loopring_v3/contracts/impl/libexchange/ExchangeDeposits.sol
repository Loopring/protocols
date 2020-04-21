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

import "../../iface/ExchangeData.sol";

import "../../lib/AddressUtil.sol";
import "../../lib/ERC20SafeTransfer.sol";

import "./ExchangeAccounts.sol";
import "./ExchangeMode.sol";
import "./ExchangeTokens.sol";


/// @title ExchangeDeposits.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeDeposits
{
    using AddressUtil       for address payable;
    using MathUint          for uint;
    using ERC20SafeTransfer for address;
    using ExchangeAccounts  for ExchangeData.State;
    using ExchangeMode      for ExchangeData.State;
    using ExchangeTokens    for ExchangeData.State;

    event DepositRequested(
        uint    indexed depositIdx,
        uint24  indexed accountID,
        uint16  indexed tokenID,
        uint96          amount,
        uint            pubKeyX,
        uint            pubKeyY
    );

    function getDepositRequest(
        ExchangeData.State storage S,
        uint index
        )
        external
        view
        returns (
          bytes32 accumulatedHash,
          uint    accumulatedFee,
          uint32  timestamp
        )
    {
        require(index < S.depositChain.length, "INVALID_INDEX");
        ExchangeData.Request storage request = S.depositChain[index];
        accumulatedHash = request.accumulatedHash;
        accumulatedFee = request.accumulatedFee;
        timestamp = request.timestamp;
    }

    function deposit(
        ExchangeData.State storage S,
        address from,
        address to,
        address tokenAddress,
        uint96  amount,  // can be zero
        uint    additionalFeeETH
        )
        external
    {
        require(to != address(0), "ZERO_ADDRESS");
        require(S.areUserRequestsEnabled(), "USER_REQUEST_SUSPENDED");
        require(getNumAvailableDepositSlots(S) > 0, "TOO_MANY_REQUESTS_OPEN");

        uint16 tokenID = S.getTokenID(tokenAddress);
        require(!S.tokens[tokenID].depositDisabled, "TOKEN_DEPOSIT_DISABLED");

        uint24 accountID = S.getAccountID(to);
        ExchangeData.Account storage account = S.accounts[accountID];

        // We allow invalid public keys to be set for accounts to
        // disable offchain request signing.
        // Make sure we can detect accounts that were not yet created in the circuits
        // by forcing the pubKeyX to be non-zero.
        require(account.pubKeyX > 0, "INVALID_PUBKEY");
        // Make sure the public key can be stored in the SNARK field
        require(account.pubKeyX < ExchangeData.SNARK_SCALAR_FIELD(), "INVALID_PUBKEY");
        require(account.pubKeyY < ExchangeData.SNARK_SCALAR_FIELD(), "INVALID_PUBKEY");

        // Total fee to be paid by the user
        uint feeETH = additionalFeeETH.add(S.depositFeeETH);

        // Add the request to the deposit chain
        ExchangeData.Request storage prevRequest = S.depositChain[S.depositChain.length - 1];
        ExchangeData.Request memory request = ExchangeData.Request(
            sha256(
                abi.encodePacked(
                    prevRequest.accumulatedHash,
                    accountID,
                    account.pubKeyX,  // Include the pubKey to allow using the same circuit for
                                      // account creation, account updating and depositing.
                                      // In the circuit we always overwrite the public keys in
                                      // the Account leaf with the data given onchain.
                    account.pubKeyY,
                    uint8(tokenID),
                    amount
                )
            ),
            prevRequest.accumulatedFee.add(feeETH),
            uint32(now)
        );
        S.depositChain.push(request);

        // Store deposit info onchain so we can withdraw from uncommitted deposit blocks
        ExchangeData.Deposit memory _deposit = ExchangeData.Deposit(
            accountID,
            tokenID,
            amount
        );
        S.deposits.push(_deposit);

        // Transfer the tokens to this contract
        transferDeposit(
            S,
            from,
            tokenAddress,
            amount,
            feeETH
        );

        emit DepositRequested(
            uint32(S.depositChain.length - 1),
            accountID,
            tokenID,
            amount,
            account.pubKeyX,
            account.pubKeyY
        );
    }

    function getNumDepositRequestsProcessed(
        ExchangeData.State storage S
        )
        public
        view
        returns (uint)
    {
        return S.numDepositRequestsCommitted;
    }

    function getNumAvailableDepositSlots(
        ExchangeData.State storage S
        )
        public
        view
        returns (uint)
    {
        uint numOpenRequests = S.depositChain.length - getNumDepositRequestsProcessed(S);
        return ExchangeData.MAX_OPEN_DEPOSIT_REQUESTS() - numOpenRequests;
    }

    function transferDeposit(
        ExchangeData.State storage S,
        address from,
        address tokenAddress,
        uint    amount,
        uint    feeETH
        )
        private
    {
        uint totalRequiredETH = feeETH;
        uint depositValueETH = 0;
        if (tokenAddress == address(0)) {
            totalRequiredETH = totalRequiredETH.add(amount);
            depositValueETH = amount;
        }

        require(msg.value >= totalRequiredETH, "INSUFFICIENT_FEE");
        uint feeSurplus = msg.value.sub(totalRequiredETH);
        if (feeSurplus > 0) {
            msg.sender.sendETHAndVerify(feeSurplus, gasleft());
        }

        // Transfer the tokens to the deposit contract (excluding the ETH fee)
        S.depositContract.deposit.value(depositValueETH)(from, tokenAddress, amount);
    }
}
