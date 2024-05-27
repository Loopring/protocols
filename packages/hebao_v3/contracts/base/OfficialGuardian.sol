// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "../lib/ERC1271.sol";
import "../lib/OwnerManagable.sol";
import "../lib/SignatureUtil.sol";
import "../lib/LoopringErrors.sol";

/// @title OfficialGuardian
/// @author Freeman Zhong - <kongliang@loopring.org>
contract OfficialGuardian is OwnerManagable, ERC1271 {
    using SignatureUtil for bytes32;

    /// @dev init owner for proxy contract:
    function initOwner(address _owner) external {
        _require(_owner != address(0), Errors.ZERO_ADDRESS);
        _require(owner == address(0), Errors.INITIALIZED_ALREADY);
        owner = _owner;
    }

    function isValidSignature(
        bytes32 _signHash,
        bytes calldata _signature
    ) public view override returns (bytes4) {
        return
            isManager(_signHash.recoverECDSASigner(_signature))
                ? ERC1271_MAGICVALUE
                : bytes4(0);
    }

    function transact(
        address target,
        uint value,
        bytes calldata data
    ) external onlyManager returns (bool success, bytes memory returnData) {
        // solhint-disable-next-line avoid-low-level-calls
        (success, returnData) = target.call{value: value}(data);
        _require(success, Errors.OFFICIALGUARDIAN_CALL_FAILED);
    }
}
