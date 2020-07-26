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

    bool   public open;

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
        bytes4 selector = IExchangeV3(0).submitBlocks.selector;
        require(open || hasAccessTo(msg.sender, selector), "PERMISSION_DENIED");
        bytes memory decompressed = LzDecompressor.decompress(data);
        require(decompressed.toBytes4(0) == selector, "INVALID_DATA");

        (bool success, bytes memory returnData) = target.call(decompressed);
        if (!success) {
            assembly { revert(add(returnData, 32), mload(returnData)) }
        }
    }

    function setOpen(bool _open)
        external
        onlyOwner
    {
        open = _open;
        emit SubmitBlocksAccessOpened(_open);
    }
}
