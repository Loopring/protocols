// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../iface/ILoopringWalletV2.sol";
import "../thirdparty/proxies/WalletProxy.sol";
import "../lib/AddressUtil.sol";
import "../lib/EIP712.sol";
import "../lib/SignatureUtil.sol";
import "../thirdparty/Create2.sol";


/// @title WalletFactory
/// @dev A factory contract to create a new wallet by deploying a proxy
///      in front of a real wallet.
/// @author Daniel Wang - <daniel@loopring.org>
contract WalletFactory
{
    using AddressUtil   for address;
    using SignatureUtil for bytes32;

    event WalletCreated (address wallet, address owner);

    bytes32             public immutable DOMAIN_SEPARATOR;
    address             public immutable walletImplementation;

    string  public constant WALLET_CREATION = "WALLET_CREATION";

    bytes32 public constant CREATE_WALLET_TYPEHASH = keccak256(
        "createWallet(address owner,address[] guardians,uint256 quota,address inheritor,address feeRecipient,address feeToken,uint256 feeAmount,uint256 salt)");

    struct WalletConfig
    {
        address   owner;
        address[] guardians;
        uint      quota;
        address   inheritor;
        address   feeRecipient;
        address   feeToken;
        uint      feeAmount;
        bytes     signature;
    }

    constructor(
        address        _walletImplementation
        )
    {
        DOMAIN_SEPARATOR = EIP712.hash(
            EIP712.Domain("WalletFactory", "2.0.0", address(this))
        );

        walletImplementation = _walletImplementation;
    }

    /// @dev Create a new wallet by deploying a proxy.
    /// @param config The wallet's config.
    /// @param salt A salt.
    /// @return wallet The new wallet address
    function createWallet(
        WalletConfig calldata config,
        uint                  salt
        )
        external
        virtual
        returns (address wallet)
    {
        _validateRequest(config, salt);
        wallet = _deploy(config.owner, salt);
        _initializeWallet(wallet, config);
    }

    function computeWalletAddress(
        address owner,
        uint    salt
        )
        public
        view
        returns (address)
    {
        return _computeWalletAddress(
            owner,
            salt,
            address(this)
        );
    }

    // --- Internal functions ---

    function _initializeWallet(
        address               wallet,
        WalletConfig calldata config
        )
        internal
    {
        ILoopringWalletV2(wallet).initialize(
            config.owner,
            config.guardians,
            config.quota,
            config.inheritor,
            config.feeRecipient,
            config.feeToken,
            config.feeAmount
        );

        emit WalletCreated(wallet, config.owner);
    }

    function _validateRequest(
        WalletConfig calldata config,
        uint                  salt
        )
        private
        view
    {
        require(config.owner != address(0), "INVALID_OWNER");

        bytes32 dataHash = keccak256(
            abi.encode(
                CREATE_WALLET_TYPEHASH,
                config.owner,
                keccak256(abi.encodePacked(config.guardians)),
                config.quota,
                config.inheritor,
                config.feeRecipient,
                config.feeToken,
                config.feeAmount,
                salt
            )
        );

        bytes32 signHash = EIP712.hashPacked(DOMAIN_SEPARATOR, dataHash);
        require(signHash.verifySignature(config.owner, config.signature), "INVALID_SIGNATURE");
    }

    function _deploy(
        address owner,
        uint    salt
        )
        internal
        returns (address payable wallet)
    {
        // Deploy the wallet proxy
        wallet = Create2.deploy(
            keccak256(abi.encodePacked(WALLET_CREATION, owner, salt)),
            _getWalletCode()
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
            keccak256(abi.encodePacked(WALLET_CREATION, owner, salt)),
            _getWalletCode(),
            deployer
        );
    }
}
