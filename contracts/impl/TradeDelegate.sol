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
pragma solidity 0.4.24;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

import "../iface/Errors.sol";
import "../iface/ITradeDelegate.sol";
import "../lib/Claimable.sol";
import "../lib/ERC20.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";
import "../lib/MemoryUtil.sol";
import "../lib/NoDefaultFunc.sol";


/// @title An Implementation of ITradeDelegate.
/// @author Daniel Wang - <daniel@loopring.org>.
/// @author Kongliang Zhong - <kongliang@loopring.org>.
contract TradeDelegate is ITradeDelegate, Claimable, NoDefaultFunc, Errors {
    using MathUint for uint;
    using ERC20SafeTransfer for address;

    bool  public suspended = false;
    mapping (address => uint) private positionMap;

    struct AuthorizedAddress {
        uint    pos;
        address addr;
    }

    modifier onlyAuthorized()
    {
        require(positionMap[msg.sender] > 0, UNAUTHORIZED);
        _;
    }

    modifier notSuspended()
    {
        require(!suspended, INVALID_STATE);
        _;
    }

    modifier isSuspended()
    {
        require(suspended, INVALID_STATE);
        _;
    }

    function authorizeAddress(
        address addr
        )
        onlyOwner
        external
    {
        require(0x0 != addr, ZERO_ADDRESS);
        require(0 == positionMap[addr], ALREADY_EXIST);
        require(isContract(addr), INVALID_ADDRESS);

        authorizedAddresses.push(addr);
        positionMap[addr] = authorizedAddresses.length;
        emit AddressAuthorized(addr);
    }

    function deauthorizeAddress(
        address addr
        )
        onlyOwner
        external
    {
        require(0x0 != addr, ZERO_ADDRESS);

        uint pos = positionMap[addr];
        require(pos != 0, NOT_FOUND);

        uint size = authorizedAddresses.length;
        if (pos != size) {
            address lastOne = authorizedAddresses[size - 1];
            authorizedAddresses[pos - 1] = lastOne;
            positionMap[lastOne] = pos;
        }

        authorizedAddresses.length -= 1;
        delete positionMap[addr];

        emit AddressDeauthorized(addr);
    }

    function batchTransfer(bytes32[] batch)
        onlyAuthorized
        notSuspended
        external
    {
        require(batch.length % 4 == 0, INVALID_SIZE);

        TradeDelegateData.TokenTransferData memory transfer;
        uint transferPtr;
        assembly {
            transferPtr := transfer
        }

        for (uint i = 0; i < batch.length; i += 4) {

            // Copy the data straight to the order struct from the call data
            MemoryUtil.copyCallDataBytesInArray(0, transferPtr, i * 32, 4 * 32);

            if (transfer.from != transfer.to && transfer.amount > 0) {
                require(
                    transfer.token.safeTransferFrom(
                        transfer.from,
                        transfer.to,
                        transfer.amount
                    ),
                    TRANSFER_FAILURE
                );
            }
        }
    }

    function batchUpdateFilled(bytes32[] filledInfo)
        onlyAuthorized
        notSuspended
        external
    {
        require(filledInfo.length % 2 == 0, INVALID_SIZE);
        for (uint i = 0; i < filledInfo.length; i += 2) {
            filled[filledInfo[i]] = uint(filledInfo[i + 1]);
        }
    }

    function isAddressAuthorized(
        address addr
        )
        public
        view
        returns (bool)
    {
        return positionMap[addr] > 0;
    }

    function setCancelled(
        address broker,
        bytes32 orderHash
        )
        onlyAuthorized
        notSuspended
        external
    {
        cancelled[broker][orderHash] = true;
    }

    function addFilled(
        bytes32 orderHash,
        uint    amount
        )
        onlyAuthorized
        notSuspended
        external
    {
        filled[orderHash] = filled[orderHash].add(amount);
    }

    function setFilled(
        bytes32 orderHash,
        uint    amount
        )
        onlyAuthorized
        notSuspended
        external
    {
        filled[orderHash] = amount;
    }

    function setCutoffs(
        address broker,
        uint    cutoff
        )
        onlyAuthorized
        notSuspended
        external
    {
        require(cutoffs[broker] < cutoff, INVALID_VALUE);
        cutoffs[broker] = cutoff;
    }

    function setTradingPairCutoffs(
        address broker,
        bytes20 tokenPair,
        uint    cutoff
        )
        onlyAuthorized
        notSuspended
        external
    {
        require(tradingPairCutoffs[broker][tokenPair] < cutoff, INVALID_VALUE);
        tradingPairCutoffs[broker][tokenPair] = cutoff;
    }

    function setCutoffsOfOwner(
        address broker,
        address owner,
        uint    cutoff
        )
        onlyAuthorized
        notSuspended
        external
    {
        require(cutoffsOwner[broker][owner] < cutoff, INVALID_VALUE);
        cutoffsOwner[broker][owner] = cutoff;
    }

    function setTradingPairCutoffsOfOwner(
        address broker,
        address owner,
        bytes20 tokenPair,
        uint    cutoff
        )
        onlyAuthorized
        notSuspended
        external
    {
        require(tradingPairCutoffsOwner[broker][owner][tokenPair] < cutoff, INVALID_VALUE);
        tradingPairCutoffsOwner[broker][owner][tokenPair] = cutoff;
    }

    function batchCheckCutoffsAndCancelled(
        bytes32[] batch
        )
        external
        view
        returns (uint)
    {
        require(batch.length % 5 == 0, INVALID_SIZE);
        require(batch.length <= 256 * 5, INVALID_SIZE);

        TradeDelegateData.OrderCheckCancelledData memory order;
        uint orderPtr;
        assembly {
            orderPtr := order
        }

        uint cutoffsValid = 0;
        for (uint i = 0; i < batch.length; i += 5) {

            // Copy the data straight to the order struct from the call data
            MemoryUtil.copyCallDataBytesInArray(0, orderPtr, i * 32, 5 * 32);

            bool valid = !cancelled[order.broker][order.hash];
            valid = valid && order.validSince > tradingPairCutoffs[order.broker][order.tradingPair];
            valid = valid && order.validSince > cutoffs[order.broker];
            valid = valid && order.validSince > tradingPairCutoffsOwner[order.broker][order.owner][order.tradingPair];
            valid = valid && order.validSince > cutoffsOwner[order.broker][order.owner];

            cutoffsValid |= valid ? (1 << (i / 5)) : 0;
        }

        return cutoffsValid;
    }

    function suspend()
        onlyOwner
        notSuspended
        external
    {
        suspended = true;
    }

    function resume()
        onlyOwner
        isSuspended
        external
    {
        suspended = false;
    }

    /// owner must suspend the delegate first before invoking the kill method.
    function kill()
        onlyOwner
        isSuspended
        external
    {
        owner = 0x0;
        emit OwnershipTransferred(owner, 0x0);
    }

    function isContract(
        address addr
        )
        internal
        view
        returns (bool)
    {
        uint size;
        assembly { size := extcodesize(addr) }
        return size > 0;
    }

}
