// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/AddressUtil.sol";
import "../../thirdparty/BytesUtil.sol";
import "../../base/Module.sol";


/// @title Module
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract MetaTxAwareModule is Module
{
    using AddressUtil for address;
    using BytesUtil   for bytes;

    modifier txAwareHashNotAllowed()
    {
        require(txAwareHash() == 0, "INVALID_TX_AWARE_HASH");
        _;
    }

    /// @dev Return's the function's logicial message sender. This method should be
    // used to replace `msg.sender` for all meta-tx enabled functions.
    function msgSender()
        internal
        override
        virtual
        view
        returns (address payable)
    {
        if (msg.sender == address(this) && msg.data.length >= 56) {
            return msg.data.toAddress(msg.data.length - 52).toPayable();
        } else {
            return msg.sender;
        }
    }

    function txAwareHash()
        internal
        view
        returns (bytes32)
    {
        if (msg.sender == address(this) && msg.data.length >= 56) {
            return msg.data.toBytes32(msg.data.length - 32);
        } else {
            return 0;
        }
    }
}
