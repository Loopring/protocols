// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../lib/ERC1271.sol";
import "../lib/OwnerManagable.sol";
import "../lib/SignatureUtil.sol";


/// @title OfficialGuardian
/// @author Freeman Zhong - <kongliang@loopring.org>
contract OfficialGuardian is OwnerManagable, ERC1271
{
    using SignatureUtil for bytes32;

    /// @dev init owner for proxy contract:
    function initOwner(address _owner)
        external
    {
        require(owner == address(0), "INITIALIZED_ALREADY");
        owner = _owner;
    }

    function isValidSignature(
        bytes32        _signHash,
        bytes   memory _signature
        )
        public
        view
        override
        returns (bytes4)
    {
        return isManager(_signHash.recoverECDSASigner(_signature))?
            ERC1271_MAGICVALUE:
            bytes4(0);
    }

    function transact(
        address  target,
        uint     value,
        bytes    calldata data
        )
        external
        onlyManager
        returns (
            bool success,
            bytes memory returnData
        )
    {
        // solium-disable-next-line security/no-call-value
        (success, returnData) = target.call{value: value}(data);
    }
}
