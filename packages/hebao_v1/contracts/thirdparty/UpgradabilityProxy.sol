// This code is taken from https://github.com/OpenZeppelin/openzeppelin-labs
// with minor modifications.

pragma solidity ^0.6.6;

import './Proxy.sol';


/**
 * @title UpgradeabilityProxy
 * @dev This contract represents a proxy where the implementation address to which it will delegate can be upgraded
 */
contract UpgradeabilityProxy is Proxy {

  // Storage position of the address of the current implementation
  bytes32 private constant implementationPosition = keccak256("org.loopring.proxy.implementation");

  /**
   * @dev Constructor function
   */
  constructor() public {}

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

  /**
   * @dev Upgrades the implementation address
   * @param newImplementation representing the address of the new implementation to be set
   */
  function _upgradeTo(address newImplementation) internal {
    address currentImplementation = implementation();
    require(currentImplementation != newImplementation);
    setImplementation(newImplementation);
  }
}