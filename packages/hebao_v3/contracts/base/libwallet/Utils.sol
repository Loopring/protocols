// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "../../lib/AddressUtil.sol";

/// @title Utils
/// @author Brecht Devos - <brecht@loopring.org>
library Utils {
    using AddressUtil for address;

    function isValidWalletOwner(address addr) internal view returns (bool) {
        return addr != address(0) && !addr.isContract();
    }
}
