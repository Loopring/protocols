pragma solidity ^0.5.4;

import "../impl/BaseModule.sol";
import "../lib/ERC20.sol";

/// @title TokenModule
/// @dev This contract provides token related functions for a wallet
///
/// @author Freeman Zhong - <kongliang@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract TokenModule is BaseModule {

    event Transfer(
        address indexed wallet,
        address indexed token,
        uint256 indexed amount,
        address to,
        bytes data
    );

    event Approved(
        address indexed wallet,
        address indexed token,
        uint256 amount,
        address spender
    );

    function tokenBalance(
        address wallet,
        address token
        )
        public
        view
        returns (uint)
    {
        if (token == address(0)) {
            return wallet.balance;
        } else {
            return ERC20(token).balanceOf(wallet);
        }
    }

    function transferToken(
        address wallet,
        address to,
        uint    value,
        address token
        )
        external
        onlyStricklyWalletOwner(wallet)
        nonReentrant
    {
        require(to != address(wallet), "SAME_ADDRESS");
        if (token == address(0)) {
            invokeWallet(wallet, to, value, "");
            emit Transfer(wallet, address(0), value, to, "");
        } else {
            bytes memory data = abi.encodeWithSignature(ERC20_TRANSFER, to, value);
            invokeWallet(wallet, token, 0, data);
            emit Transfer(wallet, token, value, to, data);
        }
    }

}
