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

import "../../lib/ERC20SafeTransfer.sol";

import "./UserStakingPoolBase.sol";

// See https://github.com/Loopring/protocols/blob/master/packages/oedax_v1/contracts/iface/IOedax.so
contract IOedax {
    function createAuction(
        address askToken,
        address bidToken,
        uint    minAskAmount,
        uint    minBidAmount,
        uint64  P,
        uint64  S,
        uint8   M,
        uint    T1,
        uint    T2
        )
        public
        payable
        returns (address payable auctionAddr);

    mapping (address => uint) public tokenRankMap;

    uint public creatorEtherStake;
}

// See https://github.com/Loopring/protocols/blob/master/packages/oedax_v1/contracts/iface/IAuction.so
contract IAuction {
    function settle() public;
    function ask(uint amount) external returns (uint accepted);
}

/// @title An Implementation of IUserStakingPool.
/// @author Daniel Wang - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
contract UserStakingPoolAuction is UserStakingPoolBase
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

	function settleAuction(address auction)
		external
		onlyOwner
	{
		require(auction != address(0), "ZERO_ADDRESS");
		IAuction(auction).settle();
	}

    // TODO(dongw): this method is not fully Implementated.
    function auctionOffTokens(
        address tokenS,
        bool    sellForEther,
        uint64  P,
        uint64  S,
        uint8   M,
        uint    T
        )
        external
        onlyOwner
        returns (
            address payable auctionAddr
        )
    {
    }
}
