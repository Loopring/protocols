// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../thirdparty/Create2.sol";
import "../thirdparty/proxies/WalletProxy.sol";


/// @title WalletDeployer
/// @dev Functionality to compute wallet addresses and to deploy wallets
/// @author Brecht Devos - <brecht@loopring.org>
contract WalletDeployer
{
    address public immutable walletImplementation;

    string  public constant WALLET_CREATION = "WALLET_CREATION";

    constructor(
        address _walletImplementation
        )
    {
        walletImplementation = _walletImplementation;
    }

    function _deploy(
        address owner,
        uint    salt
        )
        internal
        returns (address payable wallet)
    {
        wallet = Create2.deploy(
            _computeWalletSalt(owner, salt),
            _getWalletCode()
        );
    }

    function _computeWalletAddress(
        address owner,
        uint    salt,
        address deployer
        )
        internal
        view
        returns (address)
    {
        return Create2.computeAddress(
            _computeWalletSalt(owner, salt),
            _getWalletCode(),
            deployer
        );
    }

    function _getWalletCode()
        internal
        view
        returns (bytes memory)
    {
        return abi.encodePacked(
            type(WalletProxy).creationCode,
            abi.encode(walletImplementation)
        );
    }

    function _computeWalletSalt(
        address owner,
        uint    salt
        )
        internal
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked(
                WALLET_CREATION,
                owner,
                salt
            )
        );
    }
}
