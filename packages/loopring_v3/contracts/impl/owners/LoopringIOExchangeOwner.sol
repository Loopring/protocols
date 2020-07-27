// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../../iface/IExchangeV3.sol";

import "../../lib/LzDecompressor.sol";

import "../../thirdparty/BytesUtil.sol";

import "./SelectorBasedAccessManager.sol";

contract LoopringIOExchangeOwner is SelectorBasedAccessManager
{
    using BytesUtil for bytes;

    bytes4 private constant SUBMITBLOCKS_SELECTOR  = IExchangeV3.submitBlocks.selector;
    bool   public  open;

    event SubmitBlocksAccessOpened(bool open);

    constructor(address _exchange)
        public
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
        bytes memory decompressed = LzDecompressor.decompress(data);
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
