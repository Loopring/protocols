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


/// @title ITradeDelegate
/// @dev Acts as a middle man to transfer ERC20 tokens on behalf of different
/// versions of Loopring protocol to avoid ERC20 re-authorization.
/// @author Daniel Wang - <daniel@loopring.org>.
contract ITradeDelegate {
    event AddressAuthorized(
        address indexed addr
    );

    event AddressDeauthorized(
        address indexed addr
    );

    address[] authorizedAddresses;

    // The following map is used to keep trace of order fill and cancellation
    // history.
    mapping (bytes32 => uint) public filled;

    // This map is used to keep trace of order's cancellation history.
    mapping (address => mapping (bytes32 => bool)) public cancelled;

    // A map from a broker to its cutoff timestamp.
    mapping (address => uint) public cutoffs;

    // A map from a broker to its trading-pair cutoff timestamp.
    mapping (address => mapping (bytes20 => uint)) public tradingPairCutoffs;

    // A map from a broker to an order owner to its cutoff timestamp.
    mapping (address => mapping (address => uint)) public cutoffsOwner;

    // A map from a broker to an order owner to its trading-pair cutoff timestamp.
    mapping (address => mapping (address => mapping (bytes20 => uint))) public tradingPairCutoffsOwner;


    /// @dev Add a Loopring protocol address.
    /// @param addr A loopring protocol address.
    function authorizeAddress(
        address addr
        )
        external;

    /// @dev Remove a Loopring protocol address.
    /// @param addr A loopring protocol address.
    function deauthorizeAddress(
        address addr
        )
        external;

    function batchTransfer(
        bytes32[] batch
        )
        external;

    function batchUpdateFilled(
        bytes32[] filledInfo
        )
        external;

    function isAddressAuthorized(
        address addr
        )
        public
        view
        returns (bool);

    function setCancelled(
        address broker,
        bytes32 orderHash
        )
        external;

    function addFilled(
        bytes32 orderHash,
        uint amount
        )
        external;

    function setFilled(
        bytes32 orderHash,
        uint amount
        )
        external;

    function setCutoffs(
        address broker,
        uint cutoff
        )
        external;

    function setTradingPairCutoffs(
        address broker,
        bytes20 tokenPair,
        uint cutoff
        )
        external;

    function setCutoffsOfOwner(
        address broker,
        address owner,
        uint cutoff
        )
        external;

    function setTradingPairCutoffsOfOwner(
        address broker,
        address owner,
        bytes20 tokenPair,
        uint cutoff
        )
        external;

    function batchCheckCutoffsAndCancelled(
        bytes32[] orderInfo
        )
        external
        view
        returns (uint);

    function suspend()
        external;

    function resume()
        external;

    function kill()
        external;
}

library TradeDelegateData {
    struct TokenTransferData {
        address token;
        address from;
        address to;
        uint    amount;
    }
    struct OrderCheckCancelledData {
        address broker;
        address owner;
        bytes32 hash;
        uint    validSince;
        bytes20 tradingPair;
    }
}