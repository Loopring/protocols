// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../../lib/EIP712.sol";
import "../../../lib/MathUint.sol";
import "../../../lib/SignatureUtil.sol";
import "../../../thirdparty/BytesUtil.sol";
import "../../iface/ExchangeData.sol";


/// @title AmmUpdateTransaction
/// @author Brecht Devos - <brecht@loopring.org>
library AmmUpdateTransaction
{
    using BytesUtil for bytes;
    using MathUint  for uint;

    struct AmmUpdate
    {
        address owner;
        uint32  accountID;
        uint16  tokenID;
        uint8   feeBips;
        uint96  tokenWeight;
        uint96  balance;
    }

    function process(
        ExchangeData.State        storage S,
        ExchangeData.BlockContext memory  /*ctx*/,
        bytes                     memory  data,
        uint                              offset,
        bytes                     memory  /*auxiliaryData*/
        )
        internal
    {
        // Read in the deposit
        AmmUpdate memory update = readTx(data, offset);

        // Process the deposit
        ExchangeData.AmmUpdate memory pendingUpdate = S.pendingAmmUpdates[update.owner][update.accountID][update.tokenID];
        // Make sure the request was actually done
        require(pendingUpdate.validUntil >= block.timestamp, "AMM_UPDATE_DOESNT_EXIST");

        // Check the AMM data
        require(pendingUpdate.feeBips == update.feeBips, "AMM_UPDATE_INVALID_FEEBIPS");
        require(pendingUpdate.tokenWeight == update.tokenWeight, "AMM_UPDATE_INVALID_WEIGHT");

        // Delete it so it can't be used any more
        delete S.pendingAmmUpdates[update.owner][update.accountID][update.tokenID];
    }

    function readTx(
        bytes memory data,
        uint         offset
        )
        internal
        pure
        returns (AmmUpdate memory update)
    {
        // We don't use abi.decode for this because of the large amount of zero-padding
        // bytes the circuit would also have to hash.
        update.owner = data.toAddress(offset);
        offset += 20;
        update.accountID = data.toUint32(offset);
        offset += 4;
        update.tokenID = data.toUint16(offset);
        offset += 2;
        update.feeBips = data.toUint8(offset);
        offset += 1;
        update.tokenWeight = data.toUint96(offset);
        offset += 12;
        update.balance = data.toUint96(offset);
        offset += 12;
    }
}
