// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "./InheritanceLib.sol";
import "./WalletData.sol";
import "../../iface/UserOperation.sol";

library AutomationLib {
  using InheritanceLib for Wallet;

    function approveExecutor(Wallet storage wallet, address executor, address[] calldata connectors) public {
      wallet.automationPermission[executor] = AutomationPermission(connectors, true);
    }

    function unApproveExecutor(Wallet storage wallet, address executor) public {
      address[] memory empty;
      wallet.automationPermission[executor] = AutomationPermission(empty, false);
    }
    
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

    
    
    // todo: optimize this function
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
    function _verifyPermission(Wallet storage wallet, address executor, address[] memory _targets) public view returns (bool) {
      // return true;
      AutomationPermission memory permissionInfo = wallet.automationPermission[executor];
      if (permissionInfo.permitted) {
        return _arrayInArray(_targets, permissionInfo.connectorWhitelist);
      } else {
        return false;
      }
    }
    
    modifier onlyFromEntryPoint(Wallet storage wallet) {
        require(msg.sender == wallet.owner, "account: not EntryPoint");
        wallet.touchLastActiveWhenRequired();
        _;
    }

    function spell(Wallet storage wallet, address _target, bytes memory _data) internal returns (bytes memory response) {
      // address[] memory targets = new address[](1);
      // targets[0] = _target;
      // require(_verifyPermission(wallet, msg.sender, targets), "todo: permission denied"); 
      return _spell(_target, _data);
    }

    function cast(
      address[] calldata _targets,
      bytes[] calldata _datas)
      public
    {
      // wallet.
      // require(_verifyPermission(wallet, msg.sender, _targets), "todo: permission denied"); 
      uint256 _length = _targets.length;
      for (uint i = 0; i < _length; i++) {
          _spell(_targets[i], _datas[i]);
      }
    }
    function executorPermission(Wallet storage wallet, address executor) public view returns (AutomationPermission memory) {
        return wallet.automationPermission[executor];
    }
    
}
