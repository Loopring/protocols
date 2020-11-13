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

import "../lib/ERC1271.sol";
import "../lib/SignatureUtil.sol";

contract StatelessWallet is ERC1271
{
    using SignatureUtil for bytes32;
    struct TxInput
    {
        address impl;
        bytes32 statehash; // the post-transaction statehash
        bytes4  selector;
        bytes   state;
        bytes   data;
    }

    struct TxOutput
    {
        address owner;
        bool    locked;
        address impl;
        bytes   state;
    }

    uint private constant LOCK = 1 << 255;

    uint    private word1; // lock + owner address
    bytes32 public  statehash;

    function ownerAndLock() public view returns (address owner, bool isLocked)
    {
        owner = address((word1 << 1) >> 1);
        isLocked = word1 & LOCK == LOCK;
    }

    function transact(bytes calldata data)
        external
    {
        TxInput memory input = abi.decode(data, (TxInput));
        require(keccak256(abi.encodePacked(input.impl, input.state)) == statehash, "INVALID_STATE");

        (address owner, bool locked) = ownerAndLock();

        (bool success, bytes memory result) = input.impl.delegatecall(
            abi.encodePacked(
                input.selector,
                owner,
                locked,
                input.state,
                input.data
            )
        );

        require(success, "FAILED");

        TxOutput memory output = abi.decode(result, (TxOutput));
        if (output.owner != owner || output.locked != locked) {
            if (output.locked) {
                word1 = uint(output.owner) | LOCK;
            } else {
                word1 = uint(output.owner);
            }
        }

        bytes32 _statehash = keccak256(abi.encodePacked(output.impl, output.state));
        require(_statehash == input.statehash, "INVALID_NEW_STATE");

        if (statehash != _statehash) {
            statehash = _statehash;
        }
    }

    function isValidSignature(
        bytes32      _hash,
        bytes memory _signature)
        public
        override
        view
        returns (bytes4 magicValueB32)
    {
        (address owner, bool locked) = ownerAndLock();
        if (locked || !_hash.verifySignature(owner, _signature)) {
            return 0;
        } else {
            return ERC1271_MAGICVALUE;
        }
    }
}
