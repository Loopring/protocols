// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "./InheritanceLib.sol";
import "./WalletData.sol";
import "../../iface/UserOperation.sol";

library AutomationLib {
    using InheritanceLib for Wallet;
    
    event AutomationApproveExecutor (
      address wallet,
      address executor,
      address[] connectors,
      uint[]  validUntils
    );

    event AutomationAddExecutorConnectors (
      address wallet,
      address executor,
      address[] connectors,
      uint[]  validUntils
    );

    event AutomationUnapproveExecutor (
      address wallet,
      address executor
    );

    function _spell(address _target, bytes memory _data) private returns (bytes memory response) {
        require(_target != address(0), "target-invalid");
        assembly {
            let succeeded := delegatecall(gas(), _target, add(_data, 0x20), mload(_data), 0, 0)
            let size := returndatasize()
            
            response := mload(0x40)
            mstore(0x40, add(response, and(add(add(size, 0x20), 0x1f), not(0x1f))))
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

    function verifyPermission(Wallet storage wallet, address executor, address[] memory targets) internal view returns (bool) {
      mapping(address => uint) storage permissionInfo = wallet.executorsPermission[executor];
      for (uint i = 0; i < targets.length; i++){
        if (permissionInfo[targets[i]] < block.timestamp) {
          return false;
        }
      }
      return true;
    }

    function cast(
      address[] calldata targets,
      bytes[] calldata datas)
      internal
    {
      uint256 _length = targets.length;
      for (uint i = 0; i < _length; i++) {
          _spell(targets[i], datas[i]);
      }
    }
    
    function executorPermission(Wallet storage wallet, address executor) internal view returns (uint[] memory, address[] memory) {
      address[] memory connectors = wallet.executorsConnectors[executor];
      uint[] memory validUntils = new uint[](connectors.length);
      for (uint i = 0; i < connectors.length; i++) {
        validUntils[i] = wallet.executorsPermission[executor][connectors[i]];
      }
      return (validUntils, connectors);
    }

    function _unApproveExecutor(Wallet storage wallet, address executor) private {
      address[] memory connectors = wallet.executorsConnectors[executor];
      for (uint i = 0; i < connectors.length; i++) {
        wallet.executorsPermission[executor][connectors[i]] = 0;
      }
      wallet.executorsConnectors[executor] = new address[](0);
    }

    function approveExecutor(Wallet storage wallet, address executor, address[] calldata connectors, uint[] calldata validUntils) internal {
      _unApproveExecutor(wallet, executor);
      wallet.executorsConnectors[executor] = connectors;
      for (uint i = 0; i < connectors.length; i++) {
        wallet.executorsPermission[executor][connectors[i]] = validUntils[i];
      }
      emit AutomationApproveExecutor(address(this), executor, connectors, validUntils);
    }

    function addExecutorConnectors(Wallet storage wallet, address executor, address[] calldata connectors, uint[] calldata validUntils) internal {
      for (uint i = 0; i < connectors.length; i++) {
        require(wallet.executorsPermission[executor][connectors[i]] == 0); // To ensure the new list of connectors does not include any connectors from the old list.
        wallet.executorsConnectors[executor].push(connectors[i]);
        wallet.executorsPermission[executor][connectors[i]] = validUntils[i];
      }
      emit AutomationAddExecutorConnectors(address(this), executor, connectors, validUntils);
    }

    function unApproveExecutor(Wallet storage wallet, address executor) internal {
      _unApproveExecutor(wallet, executor);
      emit AutomationUnapproveExecutor(address(this), executor);
    }
}
