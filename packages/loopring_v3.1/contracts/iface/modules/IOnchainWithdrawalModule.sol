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

import "./IAbstractWithdrawalModule.sol";
import "../IAuthorizable.sol";


/// @title  IOnchainWithdrawalModule
/// @author Brecht Devos - <brecht@loopring.org>
contract IOnchainWithdrawalModule is IAbstractWithdrawalModule, IAuthorizable
{
    uint public constant REQUEST_PRIORITY = 100;
    uint public constant MAX_OPEN_REQUESTS = 1024;

    event WithdrawalRequested(
        uint    indexed withdrawalIdx,
        uint24  indexed accountID,
        uint16  indexed tokenID,
        uint96          amount
    );

    event FeesUpdated(
        uint    indexed exchangeId,
        uint            withdrawalFeeETH
    );

    uint public withdrawalFeeETH;

    /// @dev Submits an onchain request to withdraw Ether or ERC20 tokens. To withdraw
    ///      all the balance, use a very large number for `amount`.
    ///
    ///      Only the owner of the account of an authorized agent can request a withdrawal.
    ///
    ///      The total fee in ETH that the user needs to pay is 'withdrawalFee'.
    ///      If the user sends too much ETH the surplus is sent back immediately.
    ///
    ///      Note that after such an operation, it will take the operator some
    ///      time (no more than MAX_AGE_REQUEST_UNTIL_FORCED) to process the request
    ///      and create the deposit to the offchain account.
    ///
    /// @param owner The owner of the account.
    /// @param tokenAddress The address of the token, use `0x0` for Ether.
    /// @param amount The amount of tokens to deposit
    function withdraw(
        address owner,
        address tokenAddress,
        uint96 amount
        )
        external
        payable;

    /// @dev Submits an onchain request to withdraw Ether or ERC20 tokens from the
    ///      protocol fees account. The complete balance is always withdrawn.
    ///
    ///      Anyone can request a withdrawal of the protocol fees.
    ///
    ///      Note that after such an operation, it will take the operator some
    ///      time (no more than MAX_AGE_REQUEST_UNTIL_FORCED) to process the request
    ///      and create the deposit to the offchain account.
    ///
    /// @param tokenAddress The address of the token, use `0x0` for Ether.
    function withdrawProtocolFees(
        address tokenAddress
        )
        external
        payable;

    /// @dev Updates fee settings.
    ///      This function is only callable by the exchange owner.
    /// @param _withdrawalFeeETH The fee in ETH for onchain withdrawal requests
    function setFees(
        uint _withdrawalFeeETH
        )
        external;
}
