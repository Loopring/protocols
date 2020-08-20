// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../base/BaseWallet.sol";
import "../../iface/Module.sol";
import "../../iface/Wallet.sol";
import "../../lib/OwnerManagable.sol";
import "../../lib/SimpleProxy.sol";
import "../../lib/AddressUtil.sol";
import "../../lib/EIP712.sol";
import "../../thirdparty/Create2.sol";
import "../../thirdparty/ens/BaseENSManager.sol";
import "../../thirdparty/ens/ENS.sol";
import "../ControllerImpl.sol";


/// @title WalletFactory
/// @dev A factory contract to create a new wallet by deploying a proxy
///      in front of a real wallet.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract BlankWalletFactory
{
    using AddressUtil for address;
    using SignatureUtil for bytes32;

    event BlankWalletCreated(
        address wallet
    );

    address        public walletImplementation;
    ControllerImpl public controller;

    constructor(
        ControllerImpl _controller,
        address        _walletImplementation
        )
    {
        controller = _controller;
        walletImplementation = _walletImplementation;
    }

    /// @dev Create a new wallet by deploying a proxy.
    /// @param _modules The wallet's modules.
    function createWallet(
        uint _salt,
        address[] calldata _modules
        )
        external
        payable
        returns (address _wallet)
    {
        require(_modules.length > 0, "EMPTY_MODULES");

        _wallet = createWalletInternal(walletImplementation, _salt);

        Wallet w = Wallet(_wallet);
        w.initModules(_modules, address(controller));
    }

    function createWalletInternal(
        address    _implementation,
        uint       _salt
        )
        internal
        returns (address payable _wallet)
    {
        _wallet = Create2.deploy(getSalt(_salt), getWalletCode());

        SimpleProxy(_wallet).setImplementation(_implementation);

        controller.walletRegistry().registerWallet(_wallet);

        emit BlankWalletCreated(_wallet);
    }

    function computeWalletAddress(
        uint    salt
        )
        public
        view
        returns (address)
    {
        return Create2.computeAddress(
            getSalt(salt),
            getWalletCode()
        );
    }

    function getSalt(
        uint    salt
        )
        internal
        view
        returns (bytes32)
    {
        return keccak256(abi.encodePacked("WALLET_CREATION", msg.sender, salt));
    }

    function getWalletCode()
        internal
        pure
        returns (bytes memory)
    {
        return type(SimpleProxy).creationCode;
    }
}
