// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../aux/compression/ZeroDecompressor.sol";
import "../../core/iface/IExchangeV3.sol";
import "../../thirdparty/BytesUtil.sol";
import "./SelectorBasedAccessManager.sol";


contract LoopringIOExchangeOwner is SelectorBasedAccessManager
{
    using BytesUtil for bytes;

    bytes4 private constant SUBMITBLOCKS_SELECTOR  = IExchangeV3.submitBlocks.selector;
    bool   public  open;

    event SubmitBlocksAccessOpened(bool open);

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
        bytes memory decompressed = ZeroDecompressor.decompress(data);
        require(
            decompressed.toBytes4(0) == SUBMITBLOCKS_SELECTOR,
            "INVALID_DATA"
        );

        bool success;
        address addr = target;
        assembly {
            success := call(gas(), addr, 0, add(decompressed, 32), mload(decompressed), decompressed, 0)
        }
        if (!success) {
            assembly { revert(add(decompressed, 32), mload(decompressed)) }
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
