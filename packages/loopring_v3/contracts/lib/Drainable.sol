// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "./AddressUtil.sol";
import "./TransferUtil.sol";


/// @title Drainable
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev Standard functionality to allow draining funds from a contract.
abstract contract Drainable
{
    using TransferUtil      for address;

    event Drained(
        address to,
        address token,
        uint    amount
    );

    function drain(
        address to,
        address token
        )
        public
        returns (uint amount)
    {
        require(canDrain(msg.sender, token), "UNAUTHORIZED");

        amount = token.selfBalance();
        token.transferOut(to, amount);

        emit Drained(to, token, amount);
    }

    // Needs to return if the address is authorized to call drain.
    function canDrain(address drainer, address token)
        public
        virtual
        view
        returns (bool);
}
