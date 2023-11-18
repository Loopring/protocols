// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import '../iface/ILoopringWalletV2.sol';
import '../lib/EIP712.sol';
import '../lib/SignatureUtil.sol';
import './WalletDeploymentLib.sol';
import '../lib/Ownable.sol';
import '../lib/AddressSet.sol';

/// @title WalletFactory
/// @dev A factory contract to create a new wallet by deploying a proxy
///      in front of a real wallet.
/// @author Daniel Wang - <daniel@loopring.org>
contract WalletFactory is WalletDeploymentLib, Ownable, AddressSet {
    bytes32 internal constant OPERATOR = keccak256('__OPERATOR__');
    using SignatureUtil for bytes32;

    event WalletCreated(address wallet, address owner);

    event OperatorRemoved(address indexed operator);
    event OperatorAdded(address indexed operator);

    bytes32 public immutable DOMAIN_SEPARATOR;

    bytes32 public constant CREATE_WALLET_TYPEHASH =
        keccak256(
            'createWallet(address owner,address[] guardians,uint256 quota,address inheritor,address feeRecipient,address feeToken,uint256 maxFeeAmount,uint256 salt)'
        );

    ///////////////////////////////// opeartor ///////////////////
    modifier onlyOperator() {
        require(isOperator(msg.sender), 'NOT A OPERATOR');
        _;
    }

    function isOperator(address addr) public view returns (bool) {
        return isAddressInSet(OPERATOR, addr);
    }

    /// @dev Gets the operators.
    /// @return The list of operators.
    function operators() public view returns (address[] memory) {
        return addressesInSet(OPERATOR);
    }

    /// @dev Gets the number of operators.
    /// @return The numer of operators.
    function numOperators() public view returns (uint) {
        return numAddressesInSet(OPERATOR);
    }

    /// @dev Adds a new operator.
    /// @param operator The new address to add.
    function addOperator(address operator) public onlyOwner {
        addOperatorInternal(operator);
    }

    /// @dev Removes a operator.
    /// @param operator The operator to remove.
    function removeOperator(address operator) public onlyOwner {
        removeAddressFromSet(OPERATOR, operator);
        emit OperatorRemoved(operator);
    }

    function addOperatorInternal(address operator) internal {
        addAddressToSet(OPERATOR, operator, true);
        emit OperatorAdded(operator);
    }

    struct WalletConfig {
        address owner;
        address[] guardians;
        uint quota;
        address inheritor;
        address feeRecipient;
        address feeToken;
        uint maxFeeAmount;
        uint salt;
        bytes signature;
    }

    struct WalletConfigV2 {
        address owner;
        address initOwner;
        address[] guardians;
        uint quota;
        address inheritor;
        address feeRecipient;
        address feeToken;
        uint maxFeeAmount;
        uint salt;
    }

    constructor(
        address _walletImplementation
    ) WalletDeploymentLib(_walletImplementation) {
        DOMAIN_SEPARATOR = EIP712.hash(
            EIP712.Domain('WalletFactory', '2.0.0', address(this))
        );
    }

    /// @dev Create a new wallet by deploying a proxy.
    /// @param config The wallet's config.
    /// @param feeAmount The fee amount actually paid.
    /// @return wallet The new wallet address
    function createWallet(
        WalletConfig calldata config,
        uint feeAmount
    ) external onlyOperator returns (address wallet) {
        require(
            feeAmount <= config.maxFeeAmount,
            'INVALID_FEE_AMOUNT'
        );

        _validateConfig(config);
        wallet = _deploy(config.owner, config.salt);
        _initializeWallet(wallet, config, feeAmount);
    }

    /// @dev Create a new wallet by deploying a proxy.
    /// @param config The wallet's config.
    /// @param feeAmount The fee amount actually paid.
    /// @return wallet The new wallet address
    function createWalletByOperator(
        WalletConfigV2 calldata config,
        uint feeAmount
    ) external onlyOperator returns (address wallet) {
        require(
            feeAmount <= config.maxFeeAmount,
            'INVALID_FEE_AMOUNT'
        );

        require(config.owner != address(0), 'INVALID_OWNER');
        wallet = _deploy(config.initOwner, config.salt);
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

    /// @dev Computes the wallet address
    /// @param salt The initial wallet owner.
    /// @param salt A salt.
    /// @return wallet The wallet address
    function computeWalletAddress(
        address owner,
        uint salt
    ) public view returns (address) {
        return _computeWalletAddress(owner, salt, address(this));
    }

    // --- Internal functions ---

    function _initializeWallet(
        address wallet,
        WalletConfig calldata config,
        uint feeAmount
    ) internal {
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
    ) private view {
        require(config.owner != address(0), 'INVALID_OWNER');

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

        bytes32 signHash = EIP712.hashPacked(
            DOMAIN_SEPARATOR,
            dataHash
        );
        require(
            signHash.verifySignature(config.owner, config.signature),
            'INVALID_SIGNATURE'
        );
    }
}
