// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../iface/IExchangeV3.sol";

import "../lib/LzDecompressor.sol";
import "../lib/OwnerManagable.sol";
import "../lib/ReentrancyGuard.sol";

import "../thirdparty/BytesUtil.sol";


contract Operator is OwnerManagable, ReentrancyGuard
{
    using BytesUtil for bytes;

    IExchangeV3 public exchange;
    bool        public open;

    event StatusChanged(bool open);

    modifier onlyWhenOpenOrFromManager()
    {
        require(open || isManager(msg.sender), "UNAUTHORIZED");
        _;
    }

    constructor(
        address _exchangeAddress
        )
        public
        OwnerManagable()
    {
        exchange = IExchangeV3(_exchangeAddress);
    }

    function submitBlocks(
        ExchangeData.Block[] calldata blocks,
        address payable feeRecipient
        )
        external
        nonReentrant
        onlyWhenOpenOrFromManager
    {
        exchange.submitBlocks(blocks, feeRecipient);
    }

    function submitBlocksCompressed(
        bytes calldata data
        )
        external
        nonReentrant
        onlyWhenOpenOrFromManager
    {
        bytes memory decompressed = LzDecompressor.decompress(data);
        require(decompressed.toBytes4(0) == exchange.submitBlocks.selector, "INVALID_METHOD");

        (bool success, bytes memory returnData) = address(exchange).call(decompressed);
        if (!success) {
            assembly { revert(add(returnData, 32), mload(returnData)) }
        }
    }

    function setOpen(bool _open)
        external
        nonReentrant
        onlyOwner
    {
        open = _open;
        emit StatusChanged(_open);
    }
}
