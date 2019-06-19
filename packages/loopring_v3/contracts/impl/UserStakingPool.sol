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

import "./libstaking/UserStakingPoolAdmin.sol";

/// @title An Implementation of IUserStakingPool.
/// @author Daniel Wang - <daniel@loopring.org>
contract UserStakingPool is UserStakingPoolAdmin
{
    constructor(
        address _lrcAddress,
        address _oedaxAddress
        )
        public
    {
        require(_lrcAddress != address(0), "ZERO_ADDRESS");
        require(_oedaxAddress != address(0), "ZERO_ADDRESS");

        owner = msg.sender;
        allowOwnerWithdrawal = true;

        lrcAddress = _lrcAddress;
        oedaxAddress = _oedaxAddress;
    }
}
