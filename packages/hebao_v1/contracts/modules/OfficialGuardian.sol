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
    using SignatureUtil for bytes;
    mapping (address => bool) private modules;

    function isValidSignature(
        bytes memory _data,
        bytes memory _signature
        )
        public
        view
        override
        returns (bytes4)
    {
        (address addr1, address addr2) = _data.recoverECDSASigner(_signature);
        return isManager(addr1) || isManager(addr2) ?  ERC1271_MAGICVALUE : bytes4(0);
    }

    function addModule(address _module)
        external
        onlyOwner
    {
        require(_module != address(0), "NULL_MODULE");
        require(modules[_module] == false, "MODULE_EXISTS");

        modules[_module] = true;
    }

    function hasModule(address _module)
        external
        view
        returns (bool)
    {
        return modules[_module];
    }

}
