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

import "../../iface/modules/IOnchainWithdrawalModule.sol";
import "./AbstractWithdrawalModule.sol";
import "../Authorizable.sol";

import "../../lib/AddressUtil.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../iface/IExchangeV3.sol";
import "../../impl/libexchange/ExchangeData.sol";

// OnchainWithdrawalManager
import "../../iface/IExchangeModuleFactory.sol";
import "./../CircuitManager.sol";


/// @title  OnchainWithdrawalModule
/// @author Brecht Devos - <brecht@loopring.org>
contract OnchainWithdrawalModule is AbstractWithdrawalModule, Authorizable, IOnchainWithdrawalModule
{
    using AddressUtil       for address payable;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;

    constructor(address exchangeAddress, address vkProviderAddress)
        AbstractWithdrawalModule(exchangeAddress, vkProviderAddress, REQUEST_PRIORITY, MAX_OPEN_REQUESTS)
        public
    {
        // Nothing to do
    }

    function onRemove()
        external
        onlyExchange
        returns (bool)
    {
        // This module can NEVER be removed.
        // This way, users can always use this module to withdraw funds or force the
        // exchange to go into withdrawal mode by doing onchain withdrawal requests.
        return false;
    }

    function withdraw(
        address owner,
        address token,
        uint96 amount
        )
        external
        payable
        nonReentrant
        onlyAuthorizedFor(owner)
    {
        uint24 accountID = exchange.getAccountID(owner);
        withdraw(accountID, token, amount);
    }

    function withdrawProtocolFees(
        address token
        )
        external
        payable
        nonReentrant
    {
        // Always request the maximum amount so the complete balance is withdrawn
        withdraw(0, token, ExchangeData.MAX_TOKEN_BALANCE());
    }

    function setFees(
        uint _withdrawalFeeETH
        )
        external
        onlyExchangeOwner
    {
        require(
            _withdrawalFeeETH <= loopring.maxWithdrawalFee(),
            "AMOUNT_TOO_LARGE"
        );
        withdrawalFeeETH = _withdrawalFeeETH;

        emit FeesUpdated(
            exchangeId,
            withdrawalFeeETH
        );
    }

    // Internal functions

    function processBlock(
        uint32 blockSize,
        uint16 /*blockVersion*/,
        bytes  memory data,
        bytes  memory /*auxiliaryData*/,
        uint32 blockIdx
        )
        internal
    {
        uint totalNumRequestsCommitted = requestBlocks[requestBlocks.length - 1].totalNumRequestsCommitted;

        uint startIdx = 0;
        uint count = 0;
        assembly {
            startIdx := and(mload(add(data, 136)), 0xFFFFFFFF)
            count := and(mload(add(data, 140)), 0xFFFFFFFF)
        }
        require (startIdx == totalNumRequestsCommitted, "INVALID_REQUEST_RANGE");
        require (count <= blockSize, "INVALID_REQUEST_RANGE");
        require (startIdx + count <= requestChain.length, "INVALID_REQUEST_RANGE");

        if (exchange.isShutdown()) {
            require (count == 0, "INVALID_WITHDRAWAL_COUNT");
            // Don't check anything here, the operator can do all necessary withdrawals
            // in any order he wants (the circuit still ensures the withdrawals are valid)
        } else {
            require (count > 0, "INVALID_WITHDRAWAL_COUNT");
            bytes32 startingHash = requestChain[startIdx - 1].accumulatedHash;
            bytes32 endingHash = requestChain[startIdx + count - 1].accumulatedHash;
            // Pad the block so it's full
            for (uint i = count; i < blockSize; i++) {
                endingHash = sha256(
                    abi.encodePacked(
                        endingHash,
                        uint24(0),
                        uint8(0),
                        uint96(0)
                    )
                );
            }
            bytes32 inputStartingHash = 0x0;
            bytes32 inputEndingHash = 0x0;
            assembly {
                inputStartingHash := mload(add(data, 100))
                inputEndingHash := mload(add(data, 132))
            }
            require(inputStartingHash == startingHash, "INVALID_STARTING_HASH");
            require(inputEndingHash == endingHash, "INVALID_ENDING_HASH");
        }

        // Store the approved withdrawal data onchain
        bytes memory withdrawals = new bytes(0);
        uint start = 4 + 32 + 32 + 32 + 32 + 4 + 4;
        uint length = 7 * blockSize;
        assembly {
            withdrawals := add(data, start)
            mstore(withdrawals, length)
        }

        RequestBlock memory newWithdrawalBlock = RequestBlock(
            blockIdx,
            uint16(exchange.isShutdown() ? blockSize : count),
            uint32(totalNumRequestsCommitted + count),
            false,
            0,
            withdrawals
        );
        requestBlocks.push(newWithdrawalBlock);
    }

    function withdraw(
        uint24  accountID,
        address token,
        uint96  amount
        )
        internal
    {
        require(amount > 0, "ZERO_VALUE");
        require(!exchange.isInWithdrawalMode(), "INVALID_MODE");
        require(exchange.areUserRequestsEnabled(), "USER_REQUEST_SUSPENDED");
        require(getNumAvailableSlots() > 0, "TOO_MANY_REQUESTS_OPEN");

        uint16 tokenID = exchange.getTokenID(token);

        // Check ETH value sent, can be larger than the expected withdraw fee
        require(msg.value >= withdrawalFeeETH, "INSUFFICIENT_FEE");

        // Send surplus of ETH back to the sender
        uint feeSurplus = msg.value.sub(withdrawalFeeETH);
        if (feeSurplus > 0) {
            msg.sender.sendETHAndVerify(feeSurplus, gasleft());
        }

        // Add the withdraw to the withdraw chain
        Request storage prevRequest = requestChain[requestChain.length - 1];
        Request memory request = Request(
            sha256(
                abi.encodePacked(
                    prevRequest.accumulatedHash,
                    accountID,
                    uint8(tokenID),
                    amount
                )
            ),
            prevRequest.accumulatedFee.add(withdrawalFeeETH),
            uint32(now)
        );
        requestChain.push(request);

        emit WithdrawalRequested(
            uint32(requestChain.length - 1),
            accountID,
            tokenID,
            amount
        );
    }
}


/// @title OnchainWithdrawalManager
/// @author Brecht Devos - <brecht@loopring.org>
contract OnchainWithdrawalManager is IExchangeModuleFactory, CircuitManager
{
    function createModule(
        address exchangeAddress
        )
        external
        returns (address)
    {
        // Can deploy the module using a proxy (if supported), cloning,...
        OnchainWithdrawalModule instance = new OnchainWithdrawalModule(exchangeAddress, address(this));
        return address(instance);
    }
}