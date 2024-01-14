// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/access/AccessControl.sol';

contract ConnectorRegistry is AccessControl, Ownable {
    bytes32 public constant MANAGER = keccak256('MANAGER');

    mapping(address => bool) public connectors;

    modifier onlyManager() {
        require(hasRole(MANAGER, msg.sender), 'not a manager');
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, owner());
        _grantRole(MANAGER, owner());
    }

    function addConnectors(
        address[] calldata _connectors
    ) external onlyManager {
        for (uint i = 0; i < _connectors.length; ++i) {
            // allow to add same connectors multiple times
            if (!connectors[_connectors[i]]) {
                connectors[_connectors[i]] = true;
            }
        }
    }

    function removeConnectors(
        address[] calldata _connectors
    ) external onlyManager {
        for (uint i = 0; i < _connectors.length; ++i) {
            if (connectors[_connectors[i]]) {
                connectors[_connectors[i]] = false;
            }
        }
    }

    /**
     * @dev Check if Connector addresses are enabled.
     * @param connectorAddrs Array of Connector Names.
     */
    function isConnectors(
        address[] calldata connectorAddrs
    ) external view returns (bool isOk) {
        isOk = true;
        uint len = connectorAddrs.length;
        for (uint i = 0; i < len; i++) {
            if (!connectors[connectorAddrs[i]]) {
                isOk = false;
                break;
            }
        }
    }
}
