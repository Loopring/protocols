// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../iface/IExchangeV3.sol";

import "../lib/LzDecompressor.sol";
import "../lib/ReentrancyGuard.sol";


contract Operator is Claimable, ReentrancyGuard
{
    IExchangeV3 public exchange;

    bool public open;

    event StatusChanged(bool open);

    modifier onlyWhenOpenOrFromOperator()
    {
        require(open || msg.sender == owner, "UNAUTHORIZED");
        _;
    }

    constructor(
        address _exchangeAddress
        )
        public
    {
        exchange = IExchangeV3(_exchangeAddress);
    }

    function submitBlocks(
        ExchangeData.Block[] calldata blocks,
        address payable feeRecipient
        )
        external
        nonReentrant
        onlyWhenOpenOrFromOperator
    {
        exchange.submitBlocks(blocks, feeRecipient);
    }

    function submitBlocksCompressed(
        bytes calldata data
        )
        external
        nonReentrant
        onlyWhenOpenOrFromOperator
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
