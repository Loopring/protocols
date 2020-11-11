// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../base/BaseWallet.sol";


/// @title WalletImpl
contract WalletImpl is BaseWallet {
    function version()
        public
        override
        pure
        returns (string memory)
    {
        // 使用中国省会作为别名
        return "1.2.1 (wuhan)";
    }
}
