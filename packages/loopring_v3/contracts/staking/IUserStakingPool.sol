// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


/// @title IUserStakingPool
/// @dev This contract manages staked LRC tokens and their rewards.
///      WARNING: sending tokens directly to this contract will result in all
///      tokens to be lost.
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract IUserStakingPool
{
    uint public constant MIN_CLAIM_DELAY        = 90 days;
    uint public constant MIN_WITHDRAW_DELAY     = 90 days;

    address public protocolFeeVaultAddress;

    uint    public numAddresses;

    event ProtocolFeeVaultChanged (address feeVaultAddress);

    event LRCStaked       (address indexed user,  uint amount);
    event LRCWithdrawn    (address indexed user,  uint amount);
    event LRCRewarded     (address indexed user,  uint amount);

    /// @dev Returns the LRC token address
    /// @return the LRC token address
    function lrcAddress()
        external
        view
        virtual
        returns (address);

    /// @dev Sets a new IProtocolFeeVault address, only callable by the owner.
    /// @param _protocolFeeVaultAddress The new IProtocolFeeVault address.
    function setProtocolFeeVault(address _protocolFeeVaultAddress)
        external
        virtual;

    /// @dev Returns the total number of LRC staked.
    function getTotalStaking()
        public
        virtual
        view
        returns (uint);

    /// @dev Returns information related to a specific user.
    /// @param user The user address.
    /// @return withdrawalWaitTime Time in seconds that the user has to wait before any LRC can be withdrawn.
    /// @return rewardWaitTime Time in seconds that the user has to wait before any LRC reward can be claimed.
    /// @return balance The amount of LRC staked or rewarded.
    /// @return pendingReward The amount of LRC reward claimable.
    function getUserStaking(address user)
        public
        virtual
        view
        returns (
            uint withdrawalWaitTime,
            uint rewardWaitTime,
            uint balance,
            uint pendingReward
        );

    /// @dev Users call this function stake certain amount of LRC.
    ///      Note that transfering LRC directly to this contract will lost those LRC!!!
    /// @param amount The amount of LRC to stake.
    function stake(uint amount)
        external
        virtual;

    /// @dev Users call this funciton to withdraw staked LRC.
    /// @param amount The amount of LRC to withdraw.
    function withdraw(uint amount)
        external
        virtual;

    /// @dev Users call this funciton to claim all his/her LRC reward. The claimed LRC
    ///      will be staked again automatically.
    /// @param claimedAmount The amount of LRC claimed.
    function claim()
        external
        virtual
        returns (uint claimedAmount);
}
