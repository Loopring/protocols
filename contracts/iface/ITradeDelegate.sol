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

    // A map from address to its cutoff timestamp.
    mapping (address => uint) public cutoffs;

    // A map from address to its trading-pair cutoff timestamp.
    mapping (address => mapping (bytes20 => uint)) public tradingPairCutoffs;

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

    function batchUpdateHistoryAndTransferTokens(
        address   lrcTokenAddress,
        address   miner,
        address   feeRecipient,
        bytes32[] historyBatch,
        bytes32[] transferBatch
        )
        external;

    function isAddressAuthorized(
        address addr
        )
        public
        view
        returns (bool);

    function setCancelled(
        address owner,
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
        address owner,
        uint cutoff
        )
        external;

    function setTradingPairCutoffs(
        address owner,
        bytes20 tokenPair,
        uint cutoff
        )
        external;

    function checkCutoffsBatch(
        address[] owners,
        bytes20[] tradingPairs,
        uint[]    validSince
        )
        external
        view;

    function suspend()
        external;

    function resume()
        external;

    function kill()
        external;
}
