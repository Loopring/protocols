// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../../lib/AddressUtil.sol";
import "../../lib/BurnableERC20.sol";
import "../../lib/Claimable.sol";
import "../../lib/ERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/ReentrancyGuard.sol";
import "../token-sellers/ITokenSeller.sol";
import "./IProtocolFeeVault.sol";


/// @title An Implementation of IProtocolFeeVault.
/// @author Daniel Wang - <daniel@loopring.org>
contract ProtocolFeeVault is Claimable, ReentrancyGuard, IProtocolFeeVault
{
    using AddressUtil       for address;
    using AddressUtil       for address payable;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;

    address public immutable override lrcAddress;

    constructor(address _lrcAddress)
        Claimable()
    {
        require(_lrcAddress != address(0), "ZERO_ADDRESS");
        lrcAddress = _lrcAddress;
    }

    receive() external payable { }

    function updateSettings(
        address _userStakingPoolAddress,
        address _tokenSellerAddress,
        address _daoAddress
        )
        external
        override
        nonReentrant
        onlyOwner
    {
        require(
            userStakingPoolAddress != _userStakingPoolAddress ||
            tokenSellerAddress != _tokenSellerAddress ||
            daoAddress != _daoAddress,
            "SAME_ADDRESSES"
        );
        userStakingPoolAddress = _userStakingPoolAddress;
        tokenSellerAddress = _tokenSellerAddress;
        daoAddress = _daoAddress;

        emit SettingsUpdated(block.timestamp);
    }

    function claimStakingReward(
        uint amount
        )
        external
        override
        nonReentrant
    {
        require(amount > 0, "ZERO_VALUE");
        require(msg.sender == userStakingPoolAddress, "UNAUTHORIZED");
        lrcAddress.safeTransferAndVerify(userStakingPoolAddress, amount);
        claimedReward = claimedReward.add(amount);
        emit LRCClaimed(amount);
    }

    function fundDAO()
        external
        override
        nonReentrant
    {
        uint amountDAO;
        uint amountBurn;
        (, , , , , amountBurn, amountDAO, ) = getProtocolFeeStats();

        address recipient = daoAddress == address(0) ? owner : daoAddress;

        if (amountDAO > 0) {
            lrcAddress.safeTransferAndVerify(recipient, amountDAO);
        }

        if (amountBurn > 0) {
            require(BurnableERC20(lrcAddress).burn(amountBurn), "BURN_FAILURE");
        }

        claimedBurn = claimedBurn.add(amountBurn);
        claimedDAOFund = claimedDAOFund.add(amountDAO);

        emit DAOFunded(amountDAO, amountBurn);
    }

    function sellTokenForLRC(
        address token,
        uint    amount
        )
        external
        override
        nonReentrant
    {
        require(amount > 0, "ZERO_AMOUNT");
        require(token != lrcAddress, "PROHIBITED");

        address recipient = tokenSellerAddress == address(0) ? owner : tokenSellerAddress;

        if (token == address(0)) {
            recipient.sendETHAndVerify(amount, gasleft());
        } else {
            token.safeTransferAndVerify(recipient, amount);
        }

        require(
            tokenSellerAddress == address(0) ||
            ITokenSeller(tokenSellerAddress).sellToken(token, lrcAddress),
            "SELL_FAILURE"
        );

        emit TokenSold(token, amount);
    }

    function getProtocolFeeStats()
        public
        override
        view
        returns (
            uint accumulatedFees,
            uint accumulatedBurn,
            uint accumulatedDAOFund,
            uint accumulatedReward,
            uint remainingFees,
            uint remainingBurn,
            uint remainingDAOFund,
            uint remainingReward
        )
    {
        remainingFees = ERC20(lrcAddress).balanceOf(address(this));
        accumulatedFees = remainingFees.add(claimedReward).add(claimedDAOFund).add(claimedBurn);

        accumulatedReward = accumulatedFees.mul(REWARD_PERCENTAGE) / 100;
        accumulatedDAOFund = accumulatedFees.mul(DAO_PERDENTAGE) / 100;
        accumulatedBurn = accumulatedFees.sub(accumulatedReward).sub(accumulatedDAOFund);

        remainingReward = accumulatedReward.sub(claimedReward);
        remainingDAOFund = accumulatedDAOFund.sub(claimedDAOFund);
        remainingBurn = accumulatedBurn.sub(claimedBurn);
    }
}
