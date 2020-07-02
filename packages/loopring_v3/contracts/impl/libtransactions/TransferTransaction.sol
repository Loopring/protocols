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
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../../iface/ExchangeData.sol";
import "../../lib/BytesUtil.sol";
import "../../lib/EIP712.sol";
import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";


/// @title TransferTransaction
/// @author Brecht Devos - <brecht@loopring.org>
library TransferTransaction
{
    using BytesUtil            for bytes;
    using MathUint             for uint;
    using SignatureUtil        for bytes32;

    bytes32 constant public TRANSFER_TYPEHASH = keccak256(
        "Transfer(address from,address to,uint16 tokenID,uint256 amount,uint16 feeTokenID,uint256 fee,uint32 nonce)"
    );

    event ConditionalTransferConsumed(
        address indexed from,
        address indexed to,
        uint16          token,
        uint            amount
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

        // Check that this is a conditional transfer
        uint transferType = data.bytesToUint8(offset);
        offset += 1;
        require(transferType == 1, "INVALID_AUXILIARYDATA_DATA");

        // Extract the transfer data
        //uint24 fromAccountID = data.bytesToUint24(offset);
        offset += 3;
        //uint24 toAccountID = data.bytesToUint24(offset);
        offset += 3;
        uint16 tokenID = data.bytesToUint16(offset) >> 4;
        uint16 feeTokenID = uint16(data.bytesToUint16(offset + 1) & 0xFFF);
        offset += 3;
        uint amount = uint(data.bytesToUint24(offset)).decodeFloat(24);
        offset += 3;
        uint fee = uint(data.bytesToUint16(offset)).decodeFloat(16);
        offset += 2;
        uint32 nonce = data.bytesToUint32(offset);
        offset += 4;

        address from = data.bytesToAddress(offset);
        offset += 20;
        address to = data.bytesToAddress(offset);
        offset += 20;

        // Calculate the tx hash
        bytes32 txHash = hash(
            S.DOMAIN_SEPARATOR,
            from,
            to,
            tokenID,
            amount,
            feeTokenID,
            fee,
            nonce
        );

        emit ConditionalTransferConsumed(from, to, tokenID, amount);

        // Verify the signature if one is provided, otherwise fall back to an approved tx
        if (auxiliaryData.length > 0) {
            require(txHash.verifySignature(from, auxiliaryData), "INVALID_SIGNATURE");
        } else {
            require(S.approvedTx[from][txHash], "TX_NOT_APPROVED");
            S.approvedTx[from][txHash] = false;
        }
    }

    function hash(
        bytes32 DOMAIN_SEPARATOR,
        address from,
        address to,
        uint16  tokenID,
        uint    amount,
        uint16  feeTokenID,
        uint    fee,
        uint32  nonce
        )
        internal
        pure
        returns (bytes32)
    {
        return EIP712.hashPacked(
            DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    TRANSFER_TYPEHASH,
                    from,
                    to,
                    tokenID,
                    amount,
                    feeTokenID,
                    fee,
                    nonce
                )
            )
        );
    }
}
