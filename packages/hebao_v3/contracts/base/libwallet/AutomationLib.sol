// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "./InheritanceLib.sol";
import "./WalletData.sol";
import "../../iface/UserOperation.sol";

library AutomationLib {
  using InheritanceLib for Wallet;
    
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
    
    function _arrayInArray(address[] memory array1, address[] memory array2) pure private returns (bool) {
      for (uint i = 0; i < array1.length; i++){
        bool found = false;
        for (uint j = 0; j < array2.length; j++) {
          if (array2[j] == array1[i]){
            found = true;
            break;
          }
        }
        if (!found) {
          return false;
        }
      }
      return true;
    }

    function _verifyPermission(Wallet storage wallet, address executor, address[] memory targets) internal view returns (bool) {
      AutomationPermission memory permissionInfo = wallet.automationPermission[executor];
      if (permissionInfo.permitted) {
        for (uint i = 0; i < targets.length; i++){
          bool found = false;
          for (uint j = 0; j < permissionInfo.connectorWhitelist.length; j++) {
            if (permissionInfo.connectorWhitelist[j] == targets[i]){
              found = true;
              break;
            }
          }
          if (!found) {
            return false;
          }
        }
        return true;
      } else {
        return false;
      }
    }

    function spell(address target, bytes memory data) internal returns (bytes memory response) {
      return _spell(target, data);
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
    
    function executorPermission(Wallet storage wallet, address executor) internal view returns (AutomationPermission memory) {
        return wallet.automationPermission[executor];
    }

    function approveExecutor(Wallet storage wallet, address executor, address[] calldata connectors) internal {
      wallet.automationPermission[executor] = AutomationPermission(connectors, true);
    }

    function unApproveExecutor(Wallet storage wallet, address executor) internal {
      address[] memory empty;
      wallet.automationPermission[executor] = AutomationPermission(empty, false);
    }
}
