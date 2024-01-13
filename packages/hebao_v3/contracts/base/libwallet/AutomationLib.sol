// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import './InheritanceLib.sol';
import './WalletData.sol';
import '../../account-abstraction/interfaces/UserOperation.sol';

library AutomationLib {
    using InheritanceLib for Wallet;

    function _spell(
        address _target,
        bytes memory _data
    ) private returns (bytes memory response) {
        require(_target != address(0), 'target-invalid');
        assembly {
            let succeeded := delegatecall(
                gas(),
                _target,
                add(_data, 0x20),
                mload(_data),
                0,
                0
            )
            let size := returndatasize()

            response := mload(0x40)
            mstore(
                0x40,
                add(
                    response,
                    and(add(add(size, 0x20), 0x1f), not(0x1f))
                )
            )
            mstore(response, size)
            returndatacopy(add(response, 0x20), 0, size)

            switch iszero(succeeded)
            case 1 {
                // throw if delegatecall failed
                returndatacopy(0x00, 0x00, size)
                revert(0x00, size)
            }
        }
    }

    function isExecutorOrOwner(
        Wallet storage wallet,
        address executor
    ) internal view returns (bool) {
        bool isOwner = executor == wallet.owner;
        uint256 validUntil = wallet.executorsPermission[executor];
        bool isExecutor = validUntil == 0 ||
            validUntil > block.timestamp;
        return isExecutor || isOwner;
    }

    function cast(
        address[] calldata targets,
        bytes[] calldata datas
    ) internal {
        uint256 _length = targets.length;
        require(_length == datas.length, 'different length');
        // check all targets is valid
        for (uint i = 0; i < _length; i++) {
            _spell(targets[i], datas[i]);
        }
    }

    function approveExecutor(
        Wallet storage wallet,
        address executor,
        uint256 validUntil
    ) internal {
        require(
            wallet.executorsPermission[executor] < validUntil,
            'approve failed'
        );
        wallet.executorsPermission[executor] = validUntil;
    }

    function unApproveExecutor(
        Wallet storage wallet,
        address executor
    ) internal {
        require(
            wallet.executorsPermission[executor] > 0,
            'unapprove failed'
        );
        wallet.executorsPermission[executor] = 0;
    }
}
