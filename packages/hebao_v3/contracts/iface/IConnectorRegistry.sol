// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

interface IConnectorRegistry {
    function addConnectors(address[] calldata _connectors) external;

    function removeConnectors(
        address[] calldata _connectors
    ) external;

    function isConnectors(
        address[] calldata connectorAddrs
    ) external view returns (bool);
}
