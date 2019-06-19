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

import "../../iface/IUserStakingPool.sol";

import "../../lib/BurnableERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";

import "./UserStakingPoolAuction.sol";

/// @title The third part of an IUserStakingPool implementation.
/// @author Daniel Wang - <daniel@loopring.org>
contract UserStakingPoolAdmin is UserStakingPoolAuction
{
    using ERC20SafeTransfer for address;
    using MathUint          for uint;

    function setOedax(address _oedaxAddress)
        external
        onlyOwner
    {
        require(_oedaxAddress != oedaxAddress, "SAME_ADDRESS");
        oedaxAddress = _oedaxAddress;

        emit OedaxAddressUpdated(oedaxAddress);
    }

    function drainAndBurn()
        external
        onlyOwner 
    {
        uint remainingBurn;
        uint remainingDev;
        (, , , , , , remainingBurn, , remainingDev) = getStakingStats();

        require(BurnableERC20(lrcAddress).burn(remainingBurn), "BURN_FAILURE");

        require(
            lrcAddress.safeTransferFrom(address(this), owner, remainingDev),
            "TRANSFER_FAILURE"
        );

        claimedBurn = claimedBurn.add(remainingBurn);
        claimedDev = claimedDev.add(remainingDev);

        emit LRCDrained(remainingBurn, remainingDev);
    }

    function permanentlyDisableOwnerWithdrawal()
        external
        onlyOwner
    {
        require(allowOwnerWithdrawal, "DISABLED_ALREADY");
        allowOwnerWithdrawal = false;
    }

    function ownerWithdraw(
        address token,
        uint    amount
        )
        external
        onlyOwner
    {
        require(allowOwnerWithdrawal, "DISABLED_ALREADY");
        require(token != lrcAddress, "INVALD_TOKEN");

        if (token == address(0)) {
            address payable recipient = address(uint160(owner));
            require(recipient.send(amount), "TRANSFER_FAILURE");
        } else {
            require(token.safeTransfer(owner, amount), "TRANSFER_FAILURE");
        }

        emit OwnerWithdrawal(token, amount);
    }
}
