// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./BridgeData.sol";


interface IBridgeConnector
{
    function processCalls(ConnectorGroup[] calldata groups)
        external
        payable
        returns (BridgeTransfer[] memory);

    function getMinGasLimit(ConnectorGroup[] calldata groups)
        external
        pure
        returns (uint);
}