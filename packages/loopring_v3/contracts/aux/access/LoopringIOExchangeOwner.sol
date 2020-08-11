// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../aux/compression/LzDecompressor.sol";
import "../../core/iface/IExchangeV3.sol";
import "../../thirdparty/BytesUtil.sol";
import "./SelectorBasedAccessManager.sol";


contract LoopringIOExchangeOwner is SelectorBasedAccessManager
{
    using BytesUtil for bytes;

    bytes4 private constant SUBMITBLOCKS_SELECTOR  = IExchangeV3.submitBlocks.selector;
    bool   public  open;

    event SubmitBlocksAccessOpened(bool open);
    event CalldataVsComputation   (int dataReduction, uint computationCost);

    constructor(address _exchange)
        SelectorBasedAccessManager(_exchange)
    {
    }

    function submitBlocksCompressed(
        bytes calldata data
        )
        external
    {
        require(
            hasAccessTo(msg.sender, SUBMITBLOCKS_SELECTOR) || open,
            "PERMISSION_DENIED"
        );
        uint _gasleft = gasleft();
        bytes memory decompressed = LzDecompressor.decompress(data);

        // Log the gas reduction in calldata and the cost in data decompression.
        // If (decompressed.length - data.length) * 16 > (_gasleft - gasleft()), then
        // we should use `submitBlocksCompressed` more.
        emit CalldataVsComputation(decompressed.length - data.length, _gasleft - gasleft());

        require(
            decompressed.toBytes4(0) == SUBMITBLOCKS_SELECTOR,
            "INVALID_DATA"
        );

        (bool success, bytes memory returnData) = target.call(decompressed);
        if (!success) {
            assembly { revert(add(returnData, 32), mload(returnData)) }
        }
    }

    function openAccessToSubmitBlocks(bool _open)
        external
        onlyOwner
    {
        open = _open;
        emit SubmitBlocksAccessOpened(_open);
    }
}
