// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../iface/IWallet.sol";
import "../lib/OwnerManagable.sol";
import "../lib/AddressUtil.sol";
import "../lib/EIP712.sol";
import "../thirdparty/Create2.sol";
import "../thirdparty/ens/BaseENSManager.sol";
import "../thirdparty/ens/ENS.sol";
import "../thirdparty/proxy/CloneFactory.sol";
import "./MetaTxAware.sol";


/// @title WalletFactory
/// @dev A factory contract to create a new wallet by deploying a proxy
///      in front of a real wallet.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract WalletFactory
{
    using AddressUtil for address;
    using SignatureUtil for bytes32;

    event BlankDeployed (address blank);
    event BlankConsumed (address blank);
    event WalletCreated (address wallet, string ensLabel, address owner, bool blankUsed);

    string public constant WALLET_CREATION = "WALLET_CREATION";

    bytes32 public constant CREATE_WALLET_TYPEHASH = keccak256(
        "createWallet(address version, address owner,uint256 salt,address blankAddress,string ensLabel,bool ensRegisterReverse)"
    );

    mapping(address => bool) blanks;

    bytes32             public immutable DOMAIN_SEPERATOR;
    address             public immutable walletImplementation;
    bool                public immutable allowEmptyENS; // MUST be false in production

    BaseENSManager      public immutable ensManager;
    address             public immutable ensResolver;
    ENSReverseRegistrar public immutable ensReverseRegistrar;

    constructor(
        BaseENSManager _ensManager,
        address        _walletImplementation,
        bool           _allowEmptyENS
        )
    {
        DOMAIN_SEPERATOR = EIP712.hash(
            EIP712.Domain("WalletFactory", "1.3.0", address(this))
        );

        walletImplementation = _walletImplementation;
        allowEmptyENS = _allowEmptyENS;

        ensManager = _ensManager;
        ensResolver = _ensManager.ensResolver();
        ensReverseRegistrar = _ensManager.getENSReverseRegistrar();
    }

    /// @dev Create a set of new wallet blanks to be used in the future.
    /// @param salts The salts that can be used to generate nice addresses.
    function createBlanks(uint[]  calldata salts)
        external
    {
        for (uint i = 0; i < salts.length; i++) {
            address blank = _deploy(address(0), salts[i]);
            blanks[blank] = true;
            emit BlankDeployed(blank);
        }
    }

    /// @dev Create a new wallet by deploying a proxy.
    /// @param _version The wallet's version.
    /// @param _owner The wallet's owner.
    /// @param _salt A salt to adjust address.
    /// @param _ensLabel The ENS subdomain to register, use "" to skip.
    /// @param _ensApproval The signature for ENS subdomain approval.
    /// @param _ensRegisterReverse True to register reverse ENS.
    /// @param _signature The wallet owner's signature.
    /// @return _wallet The new wallet address
    function createWallet(
        address            _version,
        address            _owner,
        uint               _salt,
        string    calldata _ensLabel,
        bytes     calldata _ensApproval,
        bool               _ensRegisterReverse,
        bytes     calldata _signature
        )
        external
        payable
        returns (address _wallet)
    {
        _validateRequest(
            _version,
            _owner,
            _salt,
            address(0),
            _ensLabel,
            _ensRegisterReverse,
            _signature
        );

        _wallet = _deploy(_owner, _salt);

        _initializeWallet(
            _wallet,
            _version,
            _owner,
            _ensLabel,
            _ensApproval,
            _ensRegisterReverse,
            false
        );
    }

    /// @dev Create a new wallet by using a pre-deployed blank.
    /// @param _version The wallet's version.
    /// @param _owner The wallet's owner.
    /// @param _blank The address of the blank to use.
    /// @param _ensLabel The ENS subdomain to register, use "" to skip.
    /// @param _ensApproval The signature for ENS subdomain approval.
    /// @param _ensRegisterReverse True to register reverse ENS.
    /// @param _signature The wallet owner's signature.
    /// @return _wallet The new wallet address
    function createWallet2(
        address            _version,
        address            _owner,
        address            _blank,
        string    calldata _ensLabel,
        bytes     calldata _ensApproval,
        bool               _ensRegisterReverse,
        bytes     calldata _signature
        )
        external
        payable
        returns (address)
    {
        require(_version != address(0), "INVALID_VERSION");

        _validateRequest(
            _version,
            _owner,
            0,
            _blank,
            _ensLabel,
            _ensRegisterReverse,
            _signature
        );

        _consumeBlank(_blank);

        _initializeWallet(
            _blank,
            _version,
            _owner,
            _ensLabel,
            _ensApproval,
            _ensRegisterReverse,
            true
        );
        return _blank;
    }

    function registerENS(
        address         _wallet,
        address         _owner,
        string calldata _ensLabel,
        bytes  calldata _ensApproval,
        bool            _ensRegisterReverse
        )
        external
    {
        _registerENS(_wallet, _owner, _ensLabel, _ensApproval, _ensRegisterReverse);
    }

    function computeWalletAddress(address owner, uint salt)
        public
        view
        returns (address)
    {
        return _computeAddress(owner, salt);
    }

    function computeBlankAddress(uint salt)
        public
        view
        returns (address)
    {
        return _computeAddress(address(0), salt);
    }

    function getWalletCreationCode()
        public
        view
        returns (bytes memory)
    {
        return CloneFactory.getByteCode(walletImplementation);
    }

    function _consumeBlank(address blank)
        internal
    {
        require(blanks[blank] , "INVALID_BLANK");
        delete blanks[blank];
        emit BlankConsumed(blank);
    }

    function _deploy(address owner, uint salt)
        internal
        returns (address payable wallet)
    {
        wallet = Create2.deploy(
            keccak256(abi.encodePacked(WALLET_CREATION, owner, salt)),
            CloneFactory.getByteCode(walletImplementation)
        );
    }

    function _validateRequest(
        address            _version,
        address            _owner,
        uint               _salt,
        address            _blankAddress,
        string    memory   _ensLabel,
        bool               _ensRegisterReverse,
        bytes     memory   _signature
        )
        private
        view
    {
        require(_owner != address(0) && !_owner.isContract(), "INVALID_OWNER");
        require(_version != address(0), "INVALID_VERSION");

        bytes memory encodedRequest = abi.encode(
            CREATE_WALLET_TYPEHASH,
            _salt,
            _version,
            _owner,
            _blankAddress,
            keccak256(bytes(_ensLabel)),
            _ensRegisterReverse
        );

        bytes32 signHash = EIP712.hashPacked(DOMAIN_SEPERATOR, encodedRequest);
        require(signHash.verifySignature(_owner, _signature), "INVALID_SIGNATURE");
    }

    function _initializeWallet(
        address       _wallet,
        address       _version,
        address       _owner,
        string memory _ensLabel,
        bytes  memory _ensApproval,
        bool          _ensRegisterReverse,
        bool          _blankUsed
        )
        private
    {
        IWallet(_wallet).setVersion(_version);
        IWallet(_wallet).setOwner(_owner);

        if (bytes(_ensLabel).length > 0) {
            _registerENS(_wallet, _owner, _ensLabel, _ensApproval, _ensRegisterReverse);
        } else {
            require(allowEmptyENS, "EMPTY_ENS_NOT_ALLOWED");
        }

        emit WalletCreated(_wallet, _ensLabel, _owner, _blankUsed);
    }

    function _computeAddress(
        address owner,
        uint    salt
        )
        private
        view
        returns (address)
    {
        return Create2.computeAddress(
            keccak256(abi.encodePacked(WALLET_CREATION, owner, salt)),
            CloneFactory.getByteCode(walletImplementation)
        );
    }

    function _registerENS(
        address       wallet,
        address       owner,
        string memory ensLabel,
        bytes  memory ensApproval,
        bool          ensRegisterReverse
        )
        private
    {
        require(
            bytes(ensLabel).length > 0 &&
            ensApproval.length > 0,
            "INVALID_LABEL_OR_SIGNATURE"
        );

        ensManager.register(wallet, owner, ensLabel, ensApproval);

        if (ensRegisterReverse) {
            bytes memory data = abi.encodeWithSelector(
                ENSReverseRegistrar.claimWithResolver.selector,
                address(0), // the owner of the reverse record
                ensResolver
            );

            IWallet(wallet).transact(
                address(ensReverseRegistrar),
                0, // value
                data
            );
        }
    }
}
