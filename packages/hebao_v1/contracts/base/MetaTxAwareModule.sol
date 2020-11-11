// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./Module.sol";
import "./MetaTxAware.sol";


/// @title Module
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract MetaTxAwareModule is Module, MetaTxAware
{
    bytes32 public constant KEY_META_TX_FORWARDER =
        keccak256("eth.loopring.hebao.modules.meta_tx_forwarder");

    function metaTxForwarder()
        public
        override
        view
        returns (address)
    {
        return state.addresses[KEY_META_TX_FORWARDER];
    }
}
