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
        uint[]  calldata txValues,
        bytes[] calldata transactions
        )
        external
        payable
        onlyOwner
    {
        require(txValues.length > 0, "EMPTY_DATA");
        require(txValues.length == transactions.length, "INVALID_DATA");

        uint msgValue = msg.value;

        for (uint i = 0; i < transactions.length; i++) {
            uint txValue = txValues[i];
            require(msgValue >= txValue, "OUT_OF_ETHER");

            msgValue -= txValue;
            /* solium-disable-next-line */
            (bool success, ) = exchange.call.value(txValue)(transactions[i]);
            require(success, "FAILURE");
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

        if (_balance == 0) return;

        if (token == address(0)) {
            owner.sendETHAndVerify(_amount, gasleft());
        } else {
            token.safeTransferAndVerify(owner, _amount);
        }

        emit Drained(token, _amount);
    }

    function() external payable
    {
        if (msg.sender == owner) {
            /* solium-disable-next-line */
            (bool success, ) = exchange.call.value(msg.value)(msg.data);
            require(success, "FAILURE");
        } else {
            revert("UNSUPPORTED");
        }
    }
}
