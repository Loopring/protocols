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
pragma solidity 0.4.23;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

import "./lib/Claimable.sol";
import "./lib/ERC20.sol";
import "./lib/MathUint.sol";
import "./IBrokerInterceptor.sol";
import "./ITokenTransferDelegate.sol";


/// @title An Implementation of ITokenTransferDelegate.
/// @author Daniel Wang - <daniel@loopring.org>.
/// @author Kongliang Zhong - <kongliang@loopring.org>.
contract TokenTransferDelegate is ITokenTransferDelegate, Claimable {
    using MathUint for uint;

    address private latestAddress = 0x0;

    uint8 public walletSplitPercentage = 0;
    bool  public suspended = false;
    mapping(address => AddressInfo) public addressInfos;
    

    struct AddressInfo {
        address previous;
        uint32  index;
        bool    authorized;
    }

    constructor(
        uint8 _walletSplitPercentage
        )
        public
    {
        require(_walletSplitPercentage >= 0 && _walletSplitPercentage <= 100);
        walletSplitPercentage = _walletSplitPercentage;
    }

    modifier onlyAuthorized()
    {
        require(addressInfos[msg.sender].authorized, "unauthorized");
        _;
    }

    modifier notSuspended()
    {
        require(!suspended);
        _;
    }

    modifier isSuspended()
    {
        require(suspended);
        _;
    }

    /// @dev Disable default function.
    function ()
        payable
        external
    {
        revert();
    }

    function authorizeAddress(
        address addr
        )
        onlyOwner
        external
    {
        AddressInfo storage addrInfo = addressInfos[addr];

        if (addrInfo.index != 0) { // existing
            if (addrInfo.authorized == false) { // re-authorize
                addrInfo.authorized = true;
                emit AddressAuthorized(addr, addrInfo.index);
            }
        } else {
            address prev = latestAddress;
            if (prev == 0x0) {
                addrInfo.index = 1;
            } else {
                addrInfo.previous = prev;
                addrInfo.index = addressInfos[prev].index + 1;
            }
            addrInfo.authorized = true;
            latestAddress = addr;
            emit AddressAuthorized(addr, addrInfo.index);
        }
    }

    function deauthorizeAddress(
        address addr
        )
        onlyOwner
        external
    {
        uint32 index = addressInfos[addr].index;
        if (index != 0) {
            addressInfos[addr].authorized = false;
            emit AddressDeauthorized(addr, index);
        }
    }

    function getLatestAuthorizedAddresses(
        uint max
        )
        external
        view
        returns (address[] addresses)
    {
        addresses = new address[](max);
        address addr = latestAddress;
        AddressInfo memory addrInfo;
        uint count = 0;

        while (addr != 0x0 && count < max) {
            addrInfo = addressInfos[addr];
            if (addrInfo.index == 0) {
                break;
            }
            if (addrInfo.authorized) {
                addresses[count++] = addr;
            }
            addr = addrInfo.previous;
        }
    }

    function transferToken(
        address token,
        address from,
        address to,
        uint    value
        )
        onlyAuthorized
        notSuspended
        external
    {
        if (value > 0 && from != to && to != 0x0) {
            require(
                ERC20(token).transferFrom(from, to, value),
                "token transfer failure"
            );
        }
    }

    function batchUpdateHistoryAndTransferTokens(
        address lrcAddr,
        address   miner,
        address   feeRecipient,
        bytes32[] historyBatch,
        bytes32[] batch
        )
        onlyAuthorized
        notSuspended
        external
    {
        // require(batch.length % 9 == 0);
        // require(historyBatch.length % 2 == 0);
        // require(batch.length / 9 == historyBatch.length / 2);
        uint i;
        for (i = 0; i < historyBatch.length / 2; i += 2) {
            cancelledOrFilled[historyBatch[i]] =
                cancelledOrFilled[historyBatch[i]].add(uint(historyBatch[i + 1]));
        }

        address prevOwner = address(batch[batch.length - 9]);

        for (i = 0; i < batch.length; i += 9) {
            address owner = address(batch[i]);
            address broker = address(batch[i + 1]);
            address brokerInterceptor = address(batch[i + 2]);

            // Pay token to previous order, or to feeRecipient as previous order's
            // margin split or/and this order's margin split.
            address token = address(batch[i + 3]);
            uint amount;

            // Here batch[i + 4] has been checked not to be 0.
            if (owner != prevOwner) {
                amount = uint(batch[i + 4]);
                if (amount > 0) {
                    require(
                        ERC20(token).transferFrom(
                            owner,
                            prevOwner,
                            amount
                        ),
                        "token transfer failure"
                    );
                }

                if (brokerInterceptor != 0x0) {
                    require(
                        IBrokerInterceptor(brokerInterceptor).onTokenSpent(
                            owner,
                            broker,
                            token,
                            amount
                        ),
                        "brokerInterceptor update failure"
                    );
                }
            }

            // Miner pays LRC award to order owner
            amount = uint(batch[i + 6]);
            if (amount != 0 && miner != owner) {
                require(
                    ERC20(lrcAddr).transferFrom(
                        miner,
                        owner,
                        amount
                    ),
                    "token transfer failure"
                );
            }

            // Split margin-split income between feeRecipient and wallet
            splitPayFee(
                token,
                owner,
                feeRecipient,
                broker,
                brokerInterceptor,
                address(batch[i + 8]),
                uint(batch[i + 5])
            );

            // Split LRC fee income between feeRecipient and wallet
            splitPayFee(
                lrcAddr,
                owner,
                feeRecipient,
                broker,
                brokerInterceptor,
                address(batch[i + 8]),
                uint(batch[i + 7])
            );

            prevOwner = owner;
        }
    }

    function isAddressAuthorized(
        address addr
        )
        public
        view
        returns (bool)
    {
        return addressInfos[addr].authorized;
    }

    function splitPayFee(
        address token,
        address owner,
        address feeRecipient,
        address broker,
        address brokerInterceptor,
        address wallet,
        uint    fee
        )
        internal
    {
        if (fee == 0) {
            return;
        }

        uint walletFee = (wallet == 0x0) ? 0 : fee.mul(walletSplitPercentage) / 100;
        uint feeRecipientFee = fee.sub(walletFee);

        if (walletFee > 0 && wallet != owner) {
            require(
                ERC20(token).transferFrom(
                    owner,
                    wallet,
                    walletFee
                ),
                "token transfer failure"
            );
        }

        if (feeRecipientFee > 0 && feeRecipient != 0x0 && feeRecipient != owner) {
            require(
                ERC20(token).transferFrom(
                    owner,
                    feeRecipient,
                    feeRecipientFee
                ),
                "token transfer failure"
            );
        }

        if (broker != 0x0) {
            require(
                IBrokerInterceptor(brokerInterceptor).onTokenSpent(
                    owner,
                    broker,
                    token,
                    fee
                ),
                "token transfer failure"
            );
        }
    }

    function addCancelled(
        bytes32 orderHash,
        uint    cancelAmount
        )
        onlyAuthorized
        notSuspended
        external
    {
        cancelled[orderHash] = cancelled[orderHash].add(cancelAmount);
    }

    function addCancelledOrFilled(
        bytes32 orderHash,
        uint    cancelOrFillAmount
        )
        onlyAuthorized
        notSuspended
        external
    {
        cancelledOrFilled[orderHash] =
            cancelledOrFilled[orderHash].add(cancelOrFillAmount);
    }


    function setCutoffs(
        address owner,
        uint    cutoff
        )
        onlyAuthorized
        notSuspended
        external
    {
        cutoffs[owner] = cutoff;
    }

    function setTradingPairCutoffs(
        address owner,
        bytes20 tokenPair,
        uint    cutoff
        )
        onlyAuthorized
        notSuspended
        external
    {
        tradingPairCutoffs[owner][tokenPair] = cutoff;
    }

    function checkCutoffsBatch(
        address[] owners,
        bytes20[] tradingPairs,
        uint[]    validSince
        )
        external
        view
    {
        uint len = owners.length;
        require(len == tradingPairs.length);
        require(len == validSince.length);

        for(uint i = 0; i < len; i++) {
            require(validSince[i] > tradingPairCutoffs[owners[i]][tradingPairs[i]]);  // order trading pair is cut off
            require(validSince[i] > cutoffs[owners[i]]);                              // order is cut off
        }
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

    /// owner must suspend delegate first before invoke kill method.
    function kill()
        onlyOwner
        isSuspended
        external
    {
        owner = 0x0;
        emit OwnershipTransferred(owner, 0x0);
    }
}
