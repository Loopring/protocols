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
pragma solidity 0.4.21;


/// @title TokenTransferDelegate
/// @dev Acts as a middle man to transfer ERC20 tokens on behalf of different
/// versions of Loopring protocol to avoid ERC20 re-authorization.
/// @author Daniel Wang - <daniel@loopring.org>.
/// Recognized contributing developers from the community:
///     https://github.com/Brechtpd
contract TokenTransferDelegate {
    event AddressAuthorized(
        address indexed addr,
        uint32          number
    );

    event AddressDeauthorized(
        address indexed addr,
        uint32          number
    );

    // The following map is used to keep trace of order fill and cancellation
    // history.
    mapping (bytes32 => uint) public cancelledOrFilled;

    // This map is used to keep trace of order's cancellation history.
    mapping (bytes32 => uint) public cancelled;

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

    function getLatestAuthorizedAddresses(
        uint max
        )
        external
        view
        returns (address[] addresses);

    /// @dev Invoke ERC20 transferFrom method.
    /// @param token Address of token to transfer.
    /// @param from Address to transfer token from.
    /// @param to Address to transfer token to.
    /// @param value Amount of token to transfer.
    function transferToken(
        address token,
        address from,
        address to,
        uint    value
        )
        external;

    function batchUpdateHistoryAndTransferTokens(
        address lrcTokenAddress,
        address miner,
        address minerFeeRecipient,
        uint8 walletSplitPercentage,
        bytes32[] batch
        )
        external;

    function isAddressAuthorized(
        address addr
        )
        public
        view
        returns (bool);

    function addCancelled(bytes32 orderHash, uint cancelAmount)
        external;

    function addCancelledOrFilled(bytes32 orderHash, uint cancelOrFillAmount)
        public;

    function getCancelledOrFilledBatch(bytes32 orderHashA, bytes32 orderHashB, bytes32 orderHashC)
        external
        view
        returns (uint[3] amounts);

    function setCutoffs(uint t)
        external;

    function setTradingPairCutoffs(bytes20 tokenPair, uint t)
        external;

    function suspend() external;

    function resume() external;

    function kill() external;
}

library TokenTransfer {
    struct OrderSettleData {
        address owner;
        address tokenS;
        uint    amount;
        uint    split;
        uint    lrcReward;
        uint    lrcFee;
        address wallet;
        bytes32 orderHash;
        uint    fillAmount;
        uint    validSince;
    }
}
