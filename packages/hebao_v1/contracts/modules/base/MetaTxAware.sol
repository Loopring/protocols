// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/AddressUtil.sol";
import "../../thirdparty/BytesUtil.sol";


/// @title MetaTxAware
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by GSN's contract codebase:
/// https://github.com/opengsn/gsn/contracts
///
/// @dev Inherit this abstract contract to make a module meta-transaction
///      aware. `msgSender()` shall be used to replace `msg.sender` for
///      verifying permissions.
abstract contract MetaTxAware
{
    using AddressUtil for address;
    using BytesUtil   for bytes;

    address public trustedForwarder;

    constructor(address _trustedForwarder)
    {
        trustedForwarder = _trustedForwarder;
    }

    modifier txAwareHashNotAllowed()
    {
        // require(txAwareHash() == 0, "INVALID_TX_AWARE_HASH");
        _;
    }

    /// @dev Return's the function's logicial message sender. This method should be
    // used to replace `msg.sender` for all meta-tx enabled functions.
    function msgSender()
        internal
        view
        returns (address payable)
    {
        if (msg.data.length >= 56 && msg.sender == trustedForwarder) {
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
        if (msg.data.length >= 56 && msg.sender == trustedForwarder) {
            return msg.data.toBytes32(msg.data.length - 32);
        } else {
            return 0;
        }
    }
}
