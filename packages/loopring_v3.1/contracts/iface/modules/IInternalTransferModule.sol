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

import "./IAbstractModule.sol";
import "./ICanBeDisabled.sol";
import "../IAuthorizable.sol";


/// @title IInternalTransferModule
/// @author Brecht Devos - <brecht@loopring.org>
contract IInternalTransferModule is IAbstractModule, ICanBeDisabled, IAuthorizable
{
    event ConditionalTransferApproved(
        address indexed fromAccountID,
        address         toAccountID,
        address         token,
        uint96          amount,
        address         feeToken,
        uint96          fee,
        uint32          salt
    );

    /// @dev Approves an internal transfer using an on-chain mechanism.
    ///      All necessary data is on-chain, so no data needs be transferred to the
    ///      operator using an off-chain method.
    ///
    ///      This function can only be called by the approved agents.
    ///
    /// @param from The address of the account from where the funds are transferred out.
    /// @param to The address of the account to where 'amount' tokens are transferred.
    /// @param token The address of the token to transfer, use `0x0` for Ether.
    /// @param fAmount The 24bit floating point representation of how many tokens need to transferred.
    /// @param token The address of the fee token, use `0x0` for Ether.
    /// @param fFee The 16bit floating point representation of how many fee tokens are paid to the _operator_.
    /// @param salt A 32bit number that makes this transfer unique (this makes it possible to do multiple
    ///             identical conditional transfers). Can be any number, there is no fixed ordering like with nonces.
    function approveConditionalTransfer(
        address from,
        address to,
        address token,
        uint24  fAmount,
        address feeToken,
        uint24  fFee,
        uint32  salt
        )
        external;

    /// @dev Allows the relayer to transfer ERC-20 tokens for a user using the allowance
    ///      the user has set for the exchange.  This way the user only needs to approve a single exchange contract
    ///      for all exchange/relayer features, which allows for a more seamless user experience.
    ///
    ///      This function can only be called by the approved agents.
    ///
    /// @param token The address of the token to transfer (ETH is and cannot be suppported).
    /// @param from The address of the account that sends the tokens.
    /// @param to The address to where 'amount' tokens are transferred.
    /// @param amount The amount of tokens transferred.
    function onchainTransferFrom(
        address token,
        address from,
        address to,
        uint    amount
        )
        external;
}
