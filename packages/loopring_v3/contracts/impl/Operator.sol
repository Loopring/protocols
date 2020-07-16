// SPDX-License-Identifier: Apache-2.0
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
        // TODO(brecht): check function selector is submitBlocks
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
