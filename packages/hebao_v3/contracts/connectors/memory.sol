// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "../lib/LoopringErrors.sol";

/**
 * @title OwnedMemory.
 * @dev Store Data For Cast Function.
 */

contract Memory {
    // Memory Bytes (Smart Account Address => Storage ID => Bytes).
    mapping(address => mapping(uint => bytes32)) internal mbytes; // Use it to store execute data and delete in the same transaction
    // Memory Uint (Smart Account Address => Storage ID => Uint).
    mapping(address => mapping(uint => uint)) internal muint; // Use it to store execute data and delete in the same transaction
    // Memory Address (Smart Account Address => Storage ID => Address).
    mapping(address => mapping(uint => address)) internal maddr; // Use it to store execute data and delete in the same transaction

    /**
     * @dev Store Bytes.
     * @param _id Storage ID.
     * @param _byte bytes data to store.
     */
    function setBytes(uint _id, bytes32 _byte) public {
        mbytes[msg.sender][_id] = _byte;
    }

    /**
     * @dev Get Stored Bytes.
     * @param _id Storage ID.
     */
    function getBytes(uint _id) public returns (bytes32 _byte) {
        _byte = mbytes[msg.sender][_id];
        delete mbytes[msg.sender][_id];
    }

    /**
     * @dev Store Uint.
     * @param _id Storage ID.
     * @param _num uint data to store.
     */
    function setUint(uint _id, uint _num) public {
        muint[msg.sender][_id] = _num;
    }

    /**
     * @dev Get Stored Uint.
     * @param _id Storage ID.
     */
    function getUint(uint _id) public returns (uint _num) {
        _num = muint[msg.sender][_id];
        delete muint[msg.sender][_id];
    }

    /**
     * @dev Store Address.
     * @param _id Storage ID.
     * @param _addr Address data to store.
     */
    function setAddr(uint _id, address _addr) public {
        maddr[msg.sender][_id] = _addr;
    }

    /**
     * @dev Get Stored Address.
     * @param _id Storage ID.
     */
    function getAddr(uint _id) public returns (address _addr) {
        _addr = maddr[msg.sender][_id];
        delete maddr[msg.sender][_id];
    }
}

contract OwnedMemory is Memory {
    address public immutable master;
    address private constant BROADCAST_ADDR = address(0);

    constructor() {
        master = msg.sender;
    }

    modifier isMaster() {
        _require(msg.sender == master, Errors.MEMORY_NOT_MASTER);
        _;
    }

    /**
     * @dev Get Stored Address.
     * @param _id Storage ID.
     */
    function getBroadcastAddr(uint _id) public view returns (address _addr) {
        _addr = maddr[BROADCAST_ADDR][_id];
    }

    /**
     * @dev Store Address.
     * @param _id Storage ID.
     * @param _addr Address data to store.
     */
    function setBroadcastAddr(uint _id, address _addr) public isMaster {
        maddr[BROADCAST_ADDR][_id] = _addr;
    }
}
