// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../thirdparty/Create2.sol";
import "../thirdparty/proxies/WalletProxy.sol";


/// @title WalletDeploymentLib
/// @dev Functionality to compute wallet addresses and to deploy wallets
/// @author Brecht Devos - <brecht@loopring.org>
contract WalletDeploymentLib
{
    address public immutable walletImplementation;

    string  public constant WALLET_CREATION = "WALLET_CREATION";

    constructor(
        address _walletImplementation
        )
    {
        walletImplementation = _walletImplementation;
    }

    function getWalletCode()
        public
        view
        returns (bytes memory)
    {
        return abi.encodePacked(
            type(WalletProxy).creationCode,
            abi.encode(walletImplementation)
        );
    }

    function computeWalletSalt(
        address          owner,
        address[] memory guardians,
        uint             quota,
        address          inheritor,
        uint             salt
        )
        public
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked(
                WALLET_CREATION,
                owner,
                keccak256(abi.encodePacked(guardians)),
                quota,
                inheritor,
                salt
            )
        );
    }

    function _deploy(
        address          owner,
        address[] memory guardians,
        uint             quota,
        address          inheritor,
        uint             salt
        )
        internal
        returns (address payable wallet)
    {
        wallet = Create2.deploy(
            computeWalletSalt(
                owner,
                guardians,
                quota,
                inheritor,
                salt
            ),
            getWalletCode()
        );
    }

    function _computeWalletAddress(
        address          owner,
        address[] memory guardians,
        uint             quota,
        address          inheritor,
        uint             salt,
        address          deployer
        )
        internal
        view
        returns (address)
    {
        return Create2.computeAddress(
            computeWalletSalt(
                owner,
                guardians,
                quota,
                inheritor,
                salt
            ),
            getWalletCode(),
            deployer
        );
    }
}
