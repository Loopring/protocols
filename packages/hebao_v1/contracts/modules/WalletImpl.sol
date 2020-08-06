// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../base/BaseWallet.sol";


/// @title WalletImpl
contract WalletImpl is BaseWallet {
    function version()
        external
        override
        pure
        returns (string memory)
    {
        return "1.1.5";
    }
}
