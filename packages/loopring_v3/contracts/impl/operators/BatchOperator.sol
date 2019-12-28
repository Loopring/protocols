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

import "../../iface/IExchangeV3.sol";

import "../../lib/AddressUtil.sol";
import "../../lib/Claimable.sol";
import "../../lib/ERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";


/// @title  BatchOperator
/// @dev    This contract can act as a DEX operator to batch the following ExchangeV30
///         transactions to save some gas (~10% according to Brecht Devos):
///            - commitBlock
///            - verifyBlocks
///            - revertBlock
///            - distributeWithdrawals
///
/// @author Daniel Wang - <daniel@loopring.org>
contract BatchOperator is Claimable
{
    using ERC20SafeTransfer for address;
    using AddressUtil       for address;

    event Drained(address indexed token, uint amount);

    address public exchange;

    constructor(IExchangeV3 _exchange)
        Claimable()
        public
    {
        setExchange(_exchange);
    }

    function setExchange(IExchangeV3 _exchange)
        public
        onlyOwner
    {
        exchange = address(_exchange);
    }

    function batchCall(
        bytes[] calldata transactions
        )
        external
        payable
        onlyOwner
    {
        require(transactions.length > 0, "EMPTY_DATA");
        require(msg.value == 0, "INVALID_MSG_VALUE");

        for (uint i = 0; i < transactions.length; i++) {
            /* solium-disable-next-line */
            (bool success, ) = exchange.call(transactions[i]);
            require(success, "FAILURE");
        }
    }

    function batchCall(
        bytes[] calldata transactions,
        uint[]  calldata txValues
        )
        external
        payable
        onlyOwner
    {
        require(transactions.length > 0, "EMPTY_DATA");
        require(txValues.length == transactions.length, "INVALID_DATA");

        uint ethLeft = msg.value;

        for (uint i = 0; i < transactions.length; i++) {
            uint txValue = txValues[i];
            require(ethLeft >= txValue, "OUT_OF_ETHER");

            ethLeft -= txValue;
            /* solium-disable-next-line */
            (bool success, ) = exchange.call.value(txValue)(transactions[i]);
            require(success, "FAILURE");
        }

        if (ethLeft > 0) {
            owner.sendETHAndVerify(ethLeft, gasleft());
        }
    }

    function drain(address token, uint amount)
        external
        onlyOwner
    {
        uint _amount = amount;
        uint _balance = (token == address(0)) ?
            address(this).balance :
            ERC20(token).balanceOf(address(this));

        if (_amount == 0 || _balance < _amount) {
            _amount = _balance;
        }

        if (_amount == 0) return;

        if (token == address(0)) {
            owner.sendETHAndVerify(_amount, gasleft());
        } else {
            token.safeTransferAndVerify(owner, _amount);
        }

        emit Drained(token, _amount);
    }

    function() external payable
    {
        if (msg.sender != owner) revert("UNAUTHORIZED");

        /* solium-disable-next-line */
        (bool success, ) = exchange.call.value(msg.value)(msg.data);
        require(success, "FAILURE");
    }
}
