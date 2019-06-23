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
pragma solidity 0.5.7;

import "../iface/IProtocolFeeManager.sol";

import "../lib/Claimable.sol";
import "../lib/ERC20.sol";


/// @title An Implementation of IUserStakingPool.
/// @author Daniel Wang - <daniel@loopring.org>
contract ProtocolFeeManager is IProtocolFeeManager, Claimable
{
    constructor(
        address _lrcAddress,
        address _oedaxAddress,
        address _userStakingPoolAddress
        )
        public
    {
        require(_lrcAddress != address(0), "ZERO_ADDRESS");
        require(_oedaxAddress != address(0), "ZERO_ADDRESS");
        require(_userStakingPoolAddress != address(0), "ZERO_ADDRESS");

        owner = msg.sender;
        lrcAddress = _lrcAddress;
        oedaxAddress = _oedaxAddress;
        userStakingPoolAddress = _userStakingPoolAddress;

        // Allow the stakign pool to withdraw LRC.
        require(
            ERC20(lrcAddress).approve(userStakingPoolAddress, 2**256 - 1),
            "ERC2_AUTH_FAILED"
        );
    }
}
