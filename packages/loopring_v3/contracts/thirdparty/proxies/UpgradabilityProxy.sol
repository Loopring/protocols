// SPDX-License-Identifier: UNLICENSED
// This code is taken from https://github.com/OpenZeppelin/openzeppelin-labs
// with minor modifications.
pragma solidity ^0.7.0;

import './Proxy.sol';


/**
 * @title UpgradeabilityProxy
 * @dev This contract represents a proxy where the implementation address to which it will delegate can be upgraded
 */
contract UpgradeabilityProxy is Proxy {
  /**
   * @dev This event will be emitted every time the implementation gets upgraded
   * @param implementation representing the address of the upgraded implementation
   */
  event Upgraded(address indexed implementation);

  // Storage position of the address of the current implementation
  bytes32 private constant implementationPosition = keccak256("org.zeppelinos.proxy.implementation");
  bytes32 private constant delayedImplementationPosition = keccak256("org.zeppelinos.proxy.delayedImplementation");

  uint internal constant DELAYED_EFFECT_TIME = 7 days;

  struct DelayedImpl {
        address delayedImplementation;
        uint nextEffecteTime;
  }

  /**
   * @dev Constructor function
   */
  constructor() {}

  /**
   * @dev Tells the address of the current implementation
   * @return impl address of the current implementation
   */
  function implementation() public view override returns (address impl) {
    bytes32 position = implementationPosition;
    assembly {
      impl := sload(position)
    }
  }

  function delayedImpl() public view override returns (DelayedImpl storage delayedImpl) {
    bytes32 position = delayedImplementationPosition;
    assembly {
      delayedImpl.slot := position
    }
  }

  /**
   * @dev Sets the address of the current implementation
   * @param newImplementation address representing the new implementation to be set
   */
  function setImplementation(address newImplementation) internal {
    bytes32 position = implementationPosition;
    assembly {
      sstore(position, newImplementation)
    }
  }

  function setDelayedImplementation(address newImplementation) internal {
      DelayedImpl storage delayedImpl = delayedImpl();
      delayedImpl.delayedImplementation =  newImplementation;
      delayedImpl.nextEffectiveTime = block.timestamp + DELAYED_EFFECT_TIME;
  }

  /**
   * @dev Upgrades the implementation address
   * @param newImplementation representing the address of the new implementation to be set
   */
  function _upgradeTo(address newImplementation) internal {
    address currentImplementation = implementation();
    require(currentImplementation != newImplementation);
    if(currentImplementation == address(0)) {
        // effect immediately for the first impl
       setImplementation(newImplementation);
    } else {
        setDelayedImplementation(newImplementation);
    }
    emit Upgraded(newImplementation);
  }


  function _applyUpgrade() internal {
      DelayedImpl storage delayedImpl = delayedImpl();
      require(delayedImpl.delayedImplementation!=address(0), "NO_DELAYED_UPGRADE");
      require(block.timestamp>=delayedImpl.nextEffecteTime, "NOT_EFFECT_YET");
      setImplementation(delayedImpl.delayedImplementation);
      delete delayedImpl;
  }
}
