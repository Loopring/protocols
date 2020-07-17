// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/SignatureUtil.sol";
import "./BaseModule.sol";
import "./MetaTxAware.sol";


/// @title MetaTxModule
/// @dev Base contract for all modules that support meta-transactions.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by GSN's contract codebase:
/// https://github.com/opengsn/gsn/contracts
abstract contract MetaTxModule is MetaTxAware, BaseModule
{
    using SignatureUtil for bytes32;

    bytes32 public DOMAIN_SEPERATOR;

    constructor(
        ControllerImpl _controller,
        address        _trustedForwarder
        )
        public
        BaseModule(_controller)
        MetaTxAware(_trustedForwarder)
    {
    }

   function logicalSender()
        internal
        view
        virtual
        override
        returns (address payable)
    {
        return msgSender();
    }
}

