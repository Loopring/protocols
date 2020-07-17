// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.10;

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
        address signer = _data.recoverECDSASigner(_signature);
        return isManager(signer) ?  ERC1271_MAGICVALUE : bytes4(0);
    }
}
