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

import "../../iface/exchange/ICapability4Deposit.sol";

import "./Capability3StakeQuery.sol";

/// @title An Implementation of ICapability4Deposit.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract Capability4Deposit is ICapability4Deposit, Capability3StakeQuery
{

    function deposit(
        address token,
        uint96  amount
        )
        public
        payable
    {
        depositTo(
            msg.sender,
            token,
            amount
        );
    }

    function depositTo(
        address recipient,
        address token,
        uint96  amount
        )
        public
        payable
    {
        require(recipient != address(0), "ZERO_ADDRESS");
        require(token != address(0), "ZERO_ADDRESS");
        require(amount > 0, "ZERO_VALUE");

        uint24 accountId = addressToAccountId[recipient];
        require(accountId != 0, "ACCOUNT_NOT_EXIST");

        uint16 tokenId = tokenToTokenId[token];
        require(tokenId != 0, "UNSUPPORTED_TOKEN");

        bytes32 prevRequestHash = 0x0;
        uint numOfRequests = depositRequests.length;
        if (numOfRequests > 0) {
           prevRequestHash = depositRequests[numOfRequests - 1].hash;
        }

        bytes32 requestHash = sha256(
            abi.encodePacked(
                prevRequestHash,
                accountId,
                tokenId,
                amount,
                now
            )
        );
        DepositRequest memory request = DepositRequest(
            requestHash,
            accountId,
            tokenId,
            amount,
            now
        );
        depositRequests.push(request);
    }
}