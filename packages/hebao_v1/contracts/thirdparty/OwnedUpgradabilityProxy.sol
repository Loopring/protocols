// SPDX-License-Identifier: MIT
// This code is taken from https://github.com/OpenZeppelin/openzeppelin-labs
// with minor modifications.

pragma solidity ^0.6.10;


/**
 * @title OwnedUpgradabilityProxy
 * @dev This contract combines an upgradeability proxy with basic authorization control functionalities
 */

/// @dev We changed this implementation not to emit events to reduce gas consumption.
contract OwnedUpgradabilityProxy  {
  bytes32 private constant proxyOwnerPosition     = keccak256("org.loopring.hebao.proxy.owner");
  bytes32 private constant implementationPosition = keccak256("org.loopring.hebao.proxy.implementation");

  /**
  * @dev the constructor sets the original owner of the contract to the sender account.
  */
  constructor() public {
    _setUpgradeabilityOwner(msg.sender);
  }

  receive() payable external {
    _fallback();
  }

  fallback() payable external {
    _fallback();
  }

  function _fallback() private {
    address _impl = implementation();
    require(_impl != address(0));

    assembly {
      let ptr := mload(0x40)
      calldatacopy(ptr, 0, calldatasize())
      let result := delegatecall(gas(), _impl, ptr, calldatasize(), 0, 0)
      let size := returndatasize()
      returndatacopy(ptr, 0, size)

      switch result
      case 0 { revert(ptr, size) }
      default { return(ptr, size) }
    }
  }

  /**
  * @dev Throws if called by any account other than the owner.
  */
  modifier onlyProxyOwner() {
    require(msg.sender == proxyOwner());
    _;
  }

  /**
   * @dev Tells the address of the owner
   * @return owner the address of the owner
   */
  function proxyOwner() public view returns (address owner) {
    bytes32 position = proxyOwnerPosition;
    assembly {
      owner := sload(position)
    }
  }

  /**
   * @dev Allows the current owner to transfer control of the contract to a newOwner.
   * @param newOwner The address to transfer ownership to.
   */
  function transferProxyOwnership(address newOwner) public onlyProxyOwner {
    require(newOwner != address(0));
    _setUpgradeabilityOwner(newOwner);
  }

  /**
   * @dev Allows the proxy owner to upgrade the current version of the proxy.
   * @param implementation representing the address of the new implementation to be set.
   */
  function upgradeTo(address implementation) public onlyProxyOwner {
    _setImplementation(implementation);
  }

  /**
   * @dev Tells the address of the current implementation
   * @return impl address of the current implementation
   */
  function implementation() public view returns (address impl) {
    bytes32 position = implementationPosition;
    assembly {
      impl := sload(position)
    }
  }

  /**
   * @dev Sets the address of the owner
   */
  function _setUpgradeabilityOwner(address newProxyOwner) private {
    bytes32 position = proxyOwnerPosition;
    assembly {
      sstore(position, newProxyOwner)
    }
  }

  /**
   * @dev Sets the address of the current implementation
   * @param newImplementation address representing the new implementation to be set
   */
  function _setImplementation(address newImplementation) private {
    bytes32 position = implementationPosition;
    assembly {
      sstore(position, newImplementation)
    }
  }
}