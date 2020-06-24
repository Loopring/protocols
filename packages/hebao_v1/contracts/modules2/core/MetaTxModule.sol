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

import "../../iface/Module.sol";

import "../../thirdparty/BytesUtil.sol";

import "../../lib/AddressUtil.sol";

import "./MetaTxAware.sol";


/// @title MetaTxModule
/// @dev Base contract for all smart wallet modules.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by GSN's contract codebase:
/// https://github.com/opengsn/gsn/contracts
abstract contract MetaTxModule is MetaTxAware, Module
{
    using AddressUtil for address;
    using BytesUtil   for bytes;

    address public trustedRelayer;

    /// @dev Returns if a relayer is a trusted meta-tx relayer.
    function isTrustedRelayer(address relayer)
        public
        override
        view
        returns(bool)
    {
        return relayer == trustedRelayer;
    }

    /// @dev Return's the function's logicial message sender. This method should be
    // used to replace `msg.sender` for all meta-tx enabled functions.
    function msgSender()
        internal
        override
        view
        returns (address payable)
    {
        if (msg.data.length >= 24 && isTrustedRelayer(msg.sender)) {
            return msg.data.toAddress(msg.data.length - 20).toPayable();
        } else {
            return msg.sender;
        }
    }
}
