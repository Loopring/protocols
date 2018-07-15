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

import "../iface/IBrokerInterceptor.sol";
import "../iface/ITradeDelegate.sol";
import "../lib/Claimable.sol";
import "../lib/ERC20.sol";
import "../lib/MathUint.sol";
import "../lib/NoDefaultFunc.sol";


/// @title An Implementation of ITradeDelegate.
/// @author Daniel Wang - <daniel@loopring.org>.
/// @author Kongliang Zhong - <kongliang@loopring.org>.
contract TradeDelegate is ITradeDelegate, Claimable, NoDefaultFunc {
    using MathUint for uint;

    bool  public suspended = false;

    mapping (address => uint)   private positionMap;
    mapping (address => string) private addressToSymbolMap;
    mapping (string => address) private symbolToAddressMap;

    struct AuthorizedAddress {
        uint    pos;
        address addr;
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
        require(positionMap[msg.sender] > 0, "unauthorized");
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

    function authorizeAddress(
        address addr
        )
        onlyOwner
        external
    {
        require(0x0 !=addr, "bad address");
        require(
            0 == positionMap[addr],
            "address already exists"
        );

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
        require(0x0 != addr, "bad address");

        uint pos = positionMap[addr];
        require(pos != 0, "address not found");

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
        require(batch.length % 4 == 0);

        for (uint i = 0; i < batch.length; i += 4) {
            require(
                ERC20(address(batch[i])).transferFrom(
                    address(batch[i + 1]),
                    address(batch[i + 2]),
                    uint(batch[i + 3])
                ),
                "token transfer failure"
            );
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
        address owner,
        bytes32 orderHash
        )
        onlyAuthorized
        notSuspended
        external
    {
        cancelled[owner][orderHash] = true;
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
        address owner,
        uint    cutoff
        )
        onlyAuthorized
        notSuspended
        external
    {
        require(cutoffs[owner] < cutoff, "cutoff too small");
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
        require(tradingPairCutoffs[owner][tokenPair] < cutoff, "cutoff too small");
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

        for (uint i = 0; i < len; i++) {
            require(
                validSince[i] > tradingPairCutoffs[owners[i]][tradingPairs[i]],
                "order cancelled"
            );
            require(
                validSince[i] > cutoffs[owners[i]],
                "order cancelled"
            );
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
