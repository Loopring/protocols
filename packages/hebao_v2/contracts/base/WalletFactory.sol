// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../iface/ILoopringWalletV2.sol";
import "../lib/EIP712.sol";
import "../lib/SignatureUtil.sol";
import "./WalletDeployer.sol";


/// @title WalletFactory
/// @dev A factory contract to create a new wallet by deploying a proxy
///      in front of a real wallet.
/// @author Daniel Wang - <daniel@loopring.org>
contract WalletFactory is WalletDeployer
{
    using SignatureUtil for bytes32;

    event WalletCreated (address wallet, address owner);

    bytes32             public immutable DOMAIN_SEPARATOR;

    bytes32 public constant CREATE_WALLET_TYPEHASH = keccak256(
        "createWallet(address owner,address[] guardians,uint256 quota,address inheritor,address feeRecipient,address feeToken,uint256 maxFeeAmount,uint256 salt)");

    struct WalletConfig
    {
        address   owner;
        address[] guardians;
        uint      quota;
        address   inheritor;
        address   feeRecipient;
        address   feeToken;
        uint      maxFeeAmount;
        uint      salt;
        bytes     signature;
    }

    constructor(
        address        _walletImplementation
        )
        WalletDeployer(_walletImplementation)
    {
        DOMAIN_SEPARATOR = EIP712.hash(
            EIP712.Domain("WalletFactory", "2.0.0", address(this))
        );
    }

    /// @dev Create a new wallet by deploying a proxy.
    /// @param config The wallet's config.
    /// @param feeAmount The fee amount actually paid.
    /// @return wallet The new wallet address
    function createWallet(
        WalletConfig calldata config,
        uint                  feeAmount
        )
        external
        returns (address wallet)
    {
        require(feeAmount <= config.maxFeeAmount, "INVALID_FEE_AMOUNT");

        _validateConfig(config);
        wallet = _deploy(config.owner, config.salt);
        _initializeWallet(wallet, config, feeAmount);
    }

    /// @dev Computes the wallet address
    /// @param salt The initial wallet owner.
    /// @param salt A salt.
    /// @return wallet The wallet address
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
        WalletConfig calldata config,
        uint                  feeAmount
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
            feeAmount
        );

        emit WalletCreated(wallet, config.owner);
    }

    function _validateConfig(
        WalletConfig calldata config
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
                config.maxFeeAmount,
                config.salt
            )
        );

        bytes32 signHash = EIP712.hashPacked(DOMAIN_SEPARATOR, dataHash);
        require(signHash.verifySignature(config.owner, config.signature), "INVALID_SIGNATURE");
    }
}
