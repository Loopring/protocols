// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "../base/libwallet/WalletData.sol";
import "../base/libwallet/GuardianLib.sol";

contract DummySmartWallet {
    using GuardianLib for Wallet;
    // WARNING: Do not delete wallet state data to make this implementation
    // compatible with early versions.
    //
    //  ----- DATA LAYOUT BEGINS -----
    // Always needs to be first
    address internal masterCopy;
    Wallet public wallet;
    event Invoked(string sth);

    function getMasterCopy() public view returns (address) {
        return masterCopy;
    }

    function emitSomething() public {
        emit Invoked("hello world");
    }

    function getGuardians(
        bool includePendingAddition
    ) public view returns (Guardian[] memory) {
        return GuardianLib.guardians(wallet, includePendingAddition);
    }
}
