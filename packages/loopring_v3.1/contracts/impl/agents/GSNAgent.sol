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

import "@openzeppelin/contracts/GSN/GSNRecipient.sol";
import "@openzeppelin/contracts/GSN/bouncers/GSNBouncerSignature.sol";
import "../../iface/IExchangeInterfaceV30.sol";
import "../../lib/Refundable.sol";


/// @title GSNAgent.
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev Very basic integration with GNS (Gas Station Network).
///      - https://gsn.openzeppelin.com/
///      This will only pay the gas costs for transactions that were
///      signed with `trustedSigner`.
///      In this setup the exchange, NOT the user, will pay for the gas!
///      The same could also be implemented directly in the
///      exchange frontend contract.
contract GSNAgent is GSNRecipient, GSNBouncerSignature, Refundable
{
    IExchangeInterfaceV30 public exchange;

    constructor(address exchangeAddress, address trustedSigner)
        GSNBouncerSignature(trustedSigner)
        public
    {
        require(exchangeAddress != address(0), "ZERO_ADDRESS");
        exchange = IExchangeInterfaceV30(exchangeAddress);
    }

    function createOrUpdateAccount(
        uint    pubKeyX,
        uint    pubKeyY,
        bytes   calldata permission
        )
        external
        payable
        refund
        returns (
            uint24,
            bool,
            bool
        )
    {
        return exchange.createOrUpdateAccountFor.value(msg.value)(
            _msgSender(),
            pubKeyX,
            pubKeyY,
            permission
        );
    }

    function updateAccountAndDeposit(
        uint    pubKeyX,
        uint    pubKeyY,
        address tokenAddress,
        uint96  amount,
        bytes   calldata permission
        )
        external
        payable
        refund
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        )
    {
        return exchange.updateAccountAndDepositFor.value(msg.value)(
            _msgSender(),
            pubKeyX,
            pubKeyY,
            tokenAddress,
            amount,
            permission
        );
    }

    function deposit(
        address tokenAddress,
        uint96  amount
        )
        external
        payable
        refund
    {
        exchange.depositForTo.value(msg.value)(
            _msgSender(),
            _msgSender(),
            tokenAddress,
            amount
        );
    }

    function depositTo(
        address to,
        address tokenAddress,
        uint96  amount
        )
        external
        payable
        refund
    {
        exchange.depositForTo.value(msg.value)(
            _msgSender(),
            to,
            tokenAddress,
            amount
        );
    }

    function withdraw(
        address tokenAddress,
        uint96 amount
        )
        external
        payable
        refund
    {
        exchange.withdrawFor.value(msg.value)(
            _msgSender(),
            tokenAddress,
            amount
        );
    }
}
