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
pragma solidity ^0.6.6;
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
        DOMAIN_SEPERATOR = EIP712.hash(
            EIP712.Domain("MetaTxModule", "2.0", address(this))
        );
    }

   function logicalSender()
        internal
        virtual
        override
        returns(address payable)
    {
        return msgSender();
    }
}

