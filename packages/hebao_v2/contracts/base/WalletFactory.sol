// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./SmartWallet.sol";
import "../thirdparty/proxy/WalletProxy.sol";
import "../lib/AddressUtil.sol";
import "../lib/EIP712.sol";
import "../thirdparty/Create2.sol";
import "../thirdparty/ens/BaseENSManager.sol";


/// @title WalletFactory
/// @dev A factory contract to create a new wallet by deploying a proxy
///      in front of a real wallet.
/// @author Daniel Wang - <daniel@loopring.org>
contract WalletFactory
{
    using AddressUtil for address;
    using SignatureUtil for bytes32;

    event WalletCreated (address wallet, address owner);
    event BlankDeployed (address blank);
    event BlankConsumed (address blank);

    bytes32             public immutable DOMAIN_SEPERATOR;
    address             public immutable walletImplementation;

    BaseENSManager      public immutable ensManager;
    ENSResolver         public immutable ensResolver;
    ENSReverseRegistrar public immutable ensReverseRegistrar;

    mapping(address => bool) blanks;

    string  public constant WALLET_CREATION = "WALLET_CREATION";

    bytes32 public constant CREATE_WALLET_TYPEHASH = keccak256(
        "createWallet(address owner,address[] guardians,uint256 quota,address inheritor,address feeRecipient,address feeToken,uint256 feeAmount,string ensLabel,bool ensRegisterReverse,uint256 salt,address blankAddress)"
    );

    struct WalletConfig
    {
        address   owner;
        address[] guardians;
        uint      quota;
        address   inheritor;
        address   feeRecipient;
        address   feeToken;
        uint      feeAmount;
        string    ensLabel;
        bool      ensRegisterReverse;
        bytes     ensApproval;
        bytes     signature;
    }

    constructor(
        address        _walletImplementation,
        BaseENSManager _ensManager
        )
    {
        DOMAIN_SEPERATOR = EIP712.hash(
            EIP712.Domain("WalletFactory", "2.0.0", address(this))
        );

        walletImplementation = _walletImplementation;
        ensManager = _ensManager;

        ensResolver = ENSResolver(_ensManager.ensResolver());
        ensReverseRegistrar = _ensManager.getENSReverseRegistrar();
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
        payable
        returns (address wallet)
    {
        _validateRequest(config, salt, address(0));
        wallet = _deploy(config.owner, salt);
        _initializeWallet(wallet, config);
    }

    /// @dev Create a new wallet by using a pre-deployed blank.
    /// @param config The wallet's config.
    /// @param blank The address of the blank to use.
    /// @return wallet The new wallet address
    function createWalletFromBlank(
        WalletConfig calldata config,
        address               blank
        )
        external
        payable
        returns (address wallet)
    {
        _validateRequest(config, 0, blank);
        wallet = _consumeBlank(blank);
        _initializeWallet(wallet, config);
    }

    /// @dev Create a set of new wallet blanks to be used in the future.
    /// @param salts The salts that can be used to generate nice addresses.
    function createBlanks(uint[] calldata salts)
        external
    {
        for (uint i = 0; i < salts.length; i++) {
            _createBlank(salts[i]);
        }
    }

    function computeWalletAddress(
        address owner,
        uint    salt
        )
        public
        view
        returns (address)
    {
        return Create2.computeAddress(
            keccak256(abi.encodePacked(WALLET_CREATION, owner, salt)),
            _getWalletCode()
        );
    }

    // --- Internal functions ---

    function _initializeWallet(
        address               wallet,
        WalletConfig calldata config
        )
        internal
    {
        // ENS
        bool setupENS = ensManager != BaseENSManager(0) && bytes(config.ensLabel).length > 0;
        if (setupENS) {
            ensManager.register(wallet, config.owner, config.ensLabel, config.ensApproval);
        }

        SmartWallet(payable(wallet)).initialize(
            config.owner,
            config.guardians,
            config.quota,
            config.inheritor,
            config.ensRegisterReverse ? ensResolver : ENSResolver(0),
            config.ensRegisterReverse ? ensReverseRegistrar : ENSReverseRegistrar(0),
            config.feeRecipient,
            config.feeToken,
            config.feeAmount
        );

        emit WalletCreated(wallet, config.owner);
    }

    function _validateRequest(
        WalletConfig memory config,
        uint                salt,
        address             blankAddress
        )
        private
        view
    {
        require(config.owner != address(0), "INVALID_OWNER");

        bytes memory encodedRequest = abi.encode(
            CREATE_WALLET_TYPEHASH,
            config.owner,
            keccak256(abi.encodePacked(config.guardians)),
            config.quota,
            config.inheritor,
            config.feeRecipient,
            config.feeToken,
            config.feeAmount,
            keccak256(bytes(config.ensLabel)),
            config.ensRegisterReverse,
            salt,
            blankAddress
        );

        bytes32 signHash = EIP712.hashPacked(DOMAIN_SEPERATOR, encodedRequest);
        require(signHash.verifySignature(config.owner, config.signature), "INVALID_SIGNATURE");
    }

    function _createBlank(uint salt)
        internal
        returns (address blank)
    {
        blank = _deploy(address(0), salt);
        blanks[blank] = true;

        emit BlankDeployed(blank);
    }

    function _consumeBlank(address blank)
        internal
        returns (address)
    {
        require(blanks[blank], "INVALID_BLANK");
        delete blanks[blank];
        emit BlankConsumed(blank);
        return blank;
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
}