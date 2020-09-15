// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../lib/ERC1271.sol";
import "../lib/OwnerManagable.sol";
import "../lib/SignatureUtil.sol";
import "../thirdparty/BytesUtil.sol";


/// @title OfficialGuardian
/// @author Freeman Zhong - <kongliang@loopring.org>
contract OfficialGuardian is OwnerManagable, ERC1271
{
    using SignatureUtil for bytes32;
    mapping (address => bool) public whitelist;

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

    function addWhitelist(address target, bool toAdd)
        external
        onlyOwner
    {
        require(target != address(0), "ZERO_ADDRESS");
        require(whitelist[target] != toAdd, "SAME_VALUE");
        whitelist[target] = toAdd;
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
        require(whitelist[target], "INVALID_TARGET");
        // solium-disable-next-line security/no-call-value
        (success, returnData) = target.call{value: value}(data);
    }
}
