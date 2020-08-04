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
}
