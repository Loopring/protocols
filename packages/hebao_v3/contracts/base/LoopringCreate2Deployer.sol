// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../lib/DelayTargetSelectorBasedAccessManager.sol";

contract LoopringCreate2Deployer is DelayTargetSelectorBasedAccessManager {
    event Deployed(address addr, uint256 salt);

    function deploy(bytes memory code, uint256 salt) public {
        address addr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            addr := create2(0, add(code, 0x20), mload(code), salt)
            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }

        emit Deployed(addr, salt);
    }
}
