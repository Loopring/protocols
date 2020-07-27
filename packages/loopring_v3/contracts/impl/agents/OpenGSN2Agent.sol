// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;

import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import "@opengsn/gsn/contracts/interfaces/IKnowForwarderAddress.sol";

import "../../lib/ReentrancyGuard.sol";

contract OpenGSN2Agent is BaseRelayRecipient, IKnowForwarderAddress, ReentrancyGuard
{
    address public exchange;

    constructor(
        address _exchange,
        address _forwarder
        )
        public
    {
        exchange = _exchange;
        trustedForwarder = _forwarder;
    }

    receive()
        payable
        external
        nonReentrant
    {
        _fallback();
    }

    fallback()
        payable
        external
        nonReentrant
    {
        _fallback();
    }

    function _fallback()
        private
    {
        (bool success, bytes memory returnData) = exchange.call{value: msg.value}(
            abi.encodePacked(msg.data, _msgSender())
        );

        if (!success) {
            assembly { revert(add(returnData, 32), mload(returnData)) }
        }
    }

    function versionRecipient()
        external
        view
        override
        returns (string memory)
    {
        return "1.0";
    }

    function getTrustedForwarder()
        public
        view
        override
        returns (address)
    {
        return trustedForwarder;
    }
}