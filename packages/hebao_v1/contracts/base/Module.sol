// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../iface/IModule.sol";
import "./WalletDataLayout.sol";


/// @title Module
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract Module is IModule, WalletDataLayout
{
    function activate(address wallet) external override pure virtual { }

    function thisWallet()
        internal
        view
        returns (IWallet)
    {
        return IWallet(address(this));
    }

    function msgSender()
        internal
        virtual
        view
        returns (address payable)
    {
        return msg.sender;
    }

    function transact(
        uint8    mode,
        address  to,
        uint     value,
        bytes    calldata data
        )
        internal
        returns (bytes memory returnData)
    {
        bool success;
        if (mode == 1) {
            // solium-disable-next-line security/no-call-value
            (success, returnData) = to.call{value: value}(data);
        } else if (mode == 2) {
            // solium-disable-next-line security/no-call-value
            (success, returnData) = to.delegatecall(data);
        } else if (mode == 3) {
            require(value == 0, "INVALID_VALUE");
            // solium-disable-next-line security/no-call-value
            (success, returnData) = to.staticcall(data);
        } else {
            revert("UNSUPPORTED_MODE");
        }

        if (!success) {
            assembly {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
    }
}
