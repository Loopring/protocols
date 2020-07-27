// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../../iface/IDecompressor.sol";
import "../../iface/IExchangeV3.sol";

import "../../thirdparty/BytesUtil.sol";

import "./SelectorBasedAccessManager.sol";

contract LoopringIOExchangeOwner is SelectorBasedAccessManager
{
    using BytesUtil for bytes;

    bytes4 private constant SUBMITBLOCKS_SELECTOR  = IExchangeV3.submitBlocks.selector;

    bool          public open;
    IDecompressor public decompressor;

    event SubmitBlocksAccessOpened(bool open);
    event DecompressorChanged     (address decompressor);

    constructor(
        address _exchange,
        address _decompressor
        )
        public
        SelectorBasedAccessManager(_exchange)
    {
        decompressor = IDecompressor(_decompressor);
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
        bytes memory decompressed = decompressor.decompress(data);
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

    function setDecompressor(address _decompressor)
        external
        withAccess
    {
        require(_decompressor != address(0), "ZERO_ADDRESS");
        require(decompressor != IDecompressor(_decompressor), "SAME_ADDRESS");

        decompressor = IDecompressor(_decompressor);
        emit DecompressorChanged(_decompressor);
    }
}
