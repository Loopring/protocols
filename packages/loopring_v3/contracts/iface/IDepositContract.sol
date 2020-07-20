// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;

/// @title IDepositContract.
///        Contract storing and transferring funds for an exchange.
/// @author Brecht Devos - <brecht@loopring.org>
interface IDepositContract
{
    /// @dev Notify this contract that some token has been withdrawn to layer-1, but the
    ///      token may or may not have been transfered to the owner.
    ///
    ///      We can use this information to track the amount of each token that are still being
    ///      held by this contract but withdrawn from layer-2 already, thus calculate a more
    ///      reasonable interest index or even withdraw the tokens from DeFi contracts.
    /// @param token The address of the token withdrawn
    /// @param amount The amounto of the token withdrawn
    function notifyWithdrawal(
        address token,
        uint    amount
        )
        external;

    /// @dev Transfers tokens from a user to the exchange. This function will
    ///      be called when a user deposits funds to the exchange.
    ///      In a simple implementation the funds are simply stored inside the
    ///      deposit contract directly. More advanced implementations may store the funds
    ///      in some DeFi application to earn interest, so this function could directly
    ///      call the necessary functions to store the funds there.
    ///
    ///      This function needs to throw when an error occurred!
    ///
    ///      This function can only be called by the exchange.
    ///
    /// @param from The address of the account that sends the tokens.
    /// @param token The address of the token to transfer (`0x0` for ETH).
    /// @param amount The amount of tokens to transfer.
    /// @param auxiliaryData Opaque data that can be used by the contract to handle the deposit
    /// @return actualAmount The amount to deposit to the user's account in the Merkle tree
    /// @return tokenIndex The current index for the token being deposited
    function transferDeposit(
        address from,
        address token,
        uint    amount,
        bytes   calldata auxiliaryData
        )
        external
        payable
        returns (uint actualAmount, uint tokenIndex);

    /// @dev Transfers tokens from the exchange to a user. This function will
    ///      be called when a withdrawal is done for a user on the exchange.
    ///      In the simplest implementation the funds are simply stored inside the
    ///      deposit contract directly so this simply transfers the requested tokens back
    ///      to the user. More advanced implementations may store the funds
    ///      in some DeFi application to earn interest so the function would
    ///      need to get those tokens back from the DeFi application first before they
    ///      can be transferred to the user.
    ///
    ///      This function needs to throw when an error occurred!
    ///
    ///      This function can only be called by the exchange.
    ///
    /// @param to The address to which 'amount' tokens are transferred.
    /// @param token The address of the token to transfer (`0x0` for ETH).
    /// @param amount The amount of tokens transferred.
    /// @param auxiliaryData Opaque data that can be used by the contract to handle the withdrawal
    function transferWithdraw(
        address to,
        address token,
        uint    amount,
        bytes   calldata auxiliaryData
        )
        external
        payable;

    /// @dev Transfers tokens (ETH not supported) for a user using the allowance set
    ///      for the exchange. This way the approval can be used for all functionality (and
    ///      extended functionality) of the exchange.
    ///      Should NOT be used to deposit/withdraw user funds, `deposit`/`withdraw`
    ///      should be used for that as they will contain specialised logic for those operations.
    ///      This function can be called by the exchange to transfer onchain funds of users
    ///      necessary for Agent functionality.
    ///
    ///      This function needs to throw when an error occurred!
    ///
    ///      This function can only be called by the exchange.
    ///
    /// @param from The address of the account that sends the tokens.
    /// @param to The address to which 'amount' tokens are transferred.
    /// @param token The address of the token to transfer (ETH is and cannot be suppported).
    /// @param amount The amount of tokens transferred.
    function transfer(
        address from,
        address to,
        address token,
        uint    amount
        )
        external
        payable;

    /// @dev Checks if the given address is used for depositing ETH or not.
    ///      Is used while depositing to send the correct ETH amount to the deposit contract.
    ///
    ///      Note that 0x0 is always registered for deposting ETH when the exchange is created!
    ///      This function allows additional addresses to be used for depositing ETH, the deposit
    ///      contract can implement different behaviour based on the address value.
    ///
    /// @param addr The address to check
    /// @return True if the address is used for depositing ETH, else false.
    function isETH(address addr)
        external
        view
        returns (bool);
}