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

import "../../lib/AddressUtil.sol";

import "../../thirdparty/BytesUtil.sol";


/// @title MetaTxAware
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by GSN's contract codebase:
/// https://github.com/opengsn/gsn/contracts
abstract contract MetaTxAware
{
    using AddressUtil for address;
    using BytesUtil   for bytes;

    address public trustedForwarder;

    constructor(address _trustedForwarder) public
    {
        trustedForwarder = _trustedForwarder;
    }

    /// @dev Returns if a relayer is a trusted meta-tx relayer.
    function isTrustedForwarder(address relayer)
        public
        view
        returns(bool)
    {
        return relayer == trustedForwarder;
    }

    /// @dev Return's the function's logicial message sender. This method should be
    // used to replace `msg.sender` for all meta-tx enabled functions.
    function msgSender()
        internal
        view
        returns (address payable)
    {
        if (msg.data.length >= 24 && isTrustedForwarder(msg.sender)) {
            return msg.data.toAddress(msg.data.length - 20).toPayable();
        } else {
            return msg.sender;
        }
    }
}
