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

import "../../lib/MathUint.sol";
import "../base/BaseModule.sol";
import "./Forwarder.sol";


/// @title ForwarderModule
/// @dev Base contract for all smart wallet modules.
///
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract ForwarderModule is BaseModule, Forwarder
{
    using MathUint for uint;
    uint public constant GAS_OVERHEAD = 200000; // TODO

    constructor(ControllerImpl _controller)
        public
        BaseModule(_controller) {}

    function beforeExecute(MetaTx memory metaTx)
        internal
        override
        returns (bool /*abort*/)
    {
        require(gasleft() >= (metaTx.gasLimit.mul(64) / 63).add(GAS_OVERHEAD), "INSUFFICIENT_GAS");
        // require(controller.walletRegistry().isWalletRegistered(metaTx.from), "NOT_A_WALLET");
    }

    function afterExecute(
        MetaTx memory metaTx,
        bool          /*success*/,
        bytes  memory /*returnValue*/,
        uint          gasUsed
        )
        internal
        override
        returns(bool /*abort*/)
    {
        uint gasAmount = gasUsed < metaTx.gasLimit ? gasUsed : metaTx.gasLimit;

        if (metaTx.gasPrice > 0) {
            reimburseGasFee(
                metaTx.from,
                controller.collectTo(),
                metaTx.gasToken,
                metaTx.gasPrice,
                gasAmount.add(GAS_OVERHEAD)
            );
        }
    }
}
