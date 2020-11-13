// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

/// @title Wallet
/// @dev Base contract for smart wallets.
///      Sub-contracts must NOT use non-default constructor to initialize
///      wallet states, instead, `init` shall be used. This is to enable
///      proxies to be deployed in front of the real wallet contract for
///      saving gas.
///
/// @author Daniel Wang - <daniel@loopring.org>

contract Impl
{
    struct State1
    {
        uint abc;
    }

    function doSometing(
        address       owner,
        bool          locked,
        State1 memory state,
        uint          param1,
        uint          param2
        )
        public
    {

    }
}
