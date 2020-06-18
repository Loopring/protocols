/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "../../iface/ExchangeData.sol";
import "../../lib/BytesUtil.sol";
import "../../lib/EIP712.sol";
import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";


/// @title PublicKeyUpdateTransaction
/// @author Brecht Devos - <brecht@loopring.org>
library PublicKeyUpdateTransaction
{
    using BytesUtil            for bytes;
    using MathUint             for uint;
    using SignatureUtil        for bytes32;

    bytes32 constant public PUBLICKEYUPDATE_TYPEHASH = keccak256(
        "PublicKeyUpdate(address owner,uint24 accountID,uint32 nonce,uint256 publicKey,uint16 feeTokenID,uint256 fee)"
    );

    event KeyUpdateConsumed(
        uint24   indexed owner,
        uint             publicKey
    );

    function process(
        ExchangeData.State storage S,
        bytes memory data,
        bytes memory auxiliaryData
        )
        internal
        returns (uint /*feeETH*/)
    {
        uint offset = 1;
        // Extract the data from the tx data
        address owner = data.bytesToAddress(offset);
        offset += 20;
        uint24 accountID = data.bytesToUint24(offset);
        offset += 3;
        uint32 nonce = data.bytesToUint32(offset);
        offset += 4;
        uint publicKey = data.bytesToUint(offset);
        offset += 32;
        uint16 feeTokenID = data.bytesToUint16(offset);
        offset += 2;
        uint fee = uint(data.bytesToUint16(offset)).decodeFloat(16);
        offset += 2;

        // Calculate the tx hash
        bytes32 txHash = EIP712.hashPacked(
            S.DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    PUBLICKEYUPDATE_TYPEHASH,
                    owner,
                    accountID,
                    nonce,
                    publicKey,
                    feeTokenID,
                    fee
                )
            )
        );

        // Verify the signature if one is provided, otherwise fall back to an approved tx
        if (auxiliaryData.length > 0) {
            require(txHash.verifySignature(owner, auxiliaryData), "INVALID_SIGNATURE");
        } else {
            require(S.approvedTx[owner][txHash], "TX_NOT_APPROVED");
            S.approvedTx[owner][txHash] = false;
        }

        emit KeyUpdateConsumed(accountID, publicKey);
    }
}
