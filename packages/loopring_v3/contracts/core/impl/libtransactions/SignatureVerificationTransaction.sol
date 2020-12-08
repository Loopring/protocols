// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../../lib/EIP712.sol";
import "../../../lib/MathUint.sol";
import "../../../lib/SignatureUtil.sol";
import "../../../thirdparty/BytesUtil.sol";
import "../../iface/ExchangeData.sol";


/// @title SignatureVerificationTransaction
/// @author Brecht Devos - <brecht@loopring.org>
library SignatureVerificationTransaction
{
    using BytesUtil            for bytes;
    using MathUint             for uint;

    struct SignatureVerification
    {
        address owner;
        uint32  accountID;
        uint256 data;
    }

    function readTx(
        bytes memory data,
        uint         offset
        )
        internal
        pure
        returns (SignatureVerification memory verification)
    {
        uint _offset = offset;
        // We don't use abi.decode for this because of the large amount of zero-padding
        // bytes the circuit would also have to hash.
        verification.owner = data.toAddress(_offset);
        _offset += 20;
        verification.accountID = data.toUint32(_offset);
        _offset += 4;
        verification.data = data.toUint(_offset);
        _offset += 32;
    }
}
