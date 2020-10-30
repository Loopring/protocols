// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/iface/ExchangeData.sol";
import "../../thirdparty/opengsn2/BaseRelayRecipient.sol";
import "../../thirdparty/opengsn2/IKnowForwarderAddress.sol";


contract OpenGSN2Agent is BaseRelayRecipient, IKnowForwarderAddress
{
    address public immutable exchange;

    constructor(
        address _exchange,
        address _forwarder
        )
        BaseRelayRecipient(_forwarder)
    {
        exchange = _exchange;
    }

    modifier onlyFrom(address addr)
    {
        require(_msgSender() == addr, "ACCESS_DENIED");
        _;
    }

    function versionRecipient()
        external
        override
        pure
        returns (string memory)
    {
        return "1.0";
    }

    function getTrustedForwarder()
        public
        override
        view
        returns (address)
    {
        return trustedForwarder;
    }

    function deposit(
        address from,
        address /* to */,
        address /* tokenAddress */,
        uint96  /* amount */,
        bytes   calldata /* auxiliaryData */
        )
        external
        payable
        onlyFrom(from)
    {
        forwardCall();
    }

    function forceWithdraw(
        address owner,
        address /* token */,
        uint24  /* accountID */
        )
        external
        payable
        onlyFrom(owner)
    {
        forwardCall();
    }

    function withdrawFromDepositRequest(
        address owner,
        address /* token */,
        uint    /* index */
        )
        external
        onlyFrom(owner)
    {
        forwardCall();
    }

    function onchainTransferFrom(
        address from,
        address /* to */,
        address /* token */,
        uint    /* amount */
        )
        external
        onlyFrom(from)
    {
        forwardCall();
    }

    function approveTransaction(
        address owner,
        bytes32 /* transactionHash */
        )
        external
        onlyFrom(owner)
    {
        forwardCall();
    }

    function withdrawProtocolFees(
        address /* token */
        )
        external
        payable
    {
        forwardCall();
    }

    function withdrawFromMerkleTree(
        ExchangeData.MerkleProof calldata /* merkleProof */
        )
        external
    {
        forwardCall();
    }

    function withdrawFromApprovedWithdrawals(
        address[] calldata /* owners */,
        address[] calldata /* tokens */
        )
        external
    {
        forwardCall();
    }

    function notifyForcedRequestTooOld(
        uint24  /* accountID */,
        address /* token */
        )
        external
    {
        forwardCall();
    }

    function forwardCall()
        internal
    {
        (bool success, bytes memory returnData) =
            exchange.call{value: msg.value}(msg.data);

        if (!success) {
            assembly { revert(add(returnData, 32), mload(returnData)) }
        }
    }
}
