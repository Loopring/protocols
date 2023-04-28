// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "../thirdparty/Create2.sol";
import "../thirdparty/proxies/WalletProxy.sol";

/// @title WalletDeploymentLib
/// @dev Functionality to compute wallet addresses and to deploy wallets
/// @author Brecht Devos - <brecht@loopring.org>
contract WalletDeploymentLib {
    address public immutable walletImplementation;

    string public constant WALLET_CREATION = "WALLET_CREATION";

    constructor(address _walletImplementation) {
        walletImplementation = _walletImplementation;
    }

    function getWalletCode() public view returns (bytes memory) {
        return
            abi.encodePacked(
                type(WalletProxy).creationCode,
                abi.encode(walletImplementation)
            );
    }

    function computeWalletSalt(
        address owner,
        uint salt
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(WALLET_CREATION, owner, salt));
    }

    function _deploy(
        address owner,
        uint salt
    ) internal returns (address payable wallet) {
        wallet = Create2.deploy(
            computeWalletSalt(owner, salt),
            getWalletCode()
        );
    }

    function _computeWalletAddress(
        address owner,
        uint salt,
        address deployer
    ) internal view returns (address) {
        return
            Create2.computeAddress(
                computeWalletSalt(owner, salt),
                getWalletCode(),
                deployer
            );
    }
}
