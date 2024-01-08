// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

contract BaseConnector {
    address internal constant ethAddr =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    address internal constant wethAddr =
        0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    constructor() {}

    function getUint(
        uint getId,
        uint val
    ) internal returns (uint returnVal) {
        // returnVal = getId == 0 ? val : instaMemory.getUint(getId);
    }

    /**
     * @dev Set Uint value in InstaMemory Contract.
     */
    function setUint(uint setId, uint val) internal virtual {
        // if (setId != 0) instaMemory.setUint(setId, val);
    }
}
