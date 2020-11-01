// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../base/BaseWallet.sol";
import "../../iface/Module.sol";
import "../../iface/Wallet.sol";
import "../../lib/OwnerManagable.sol";
import "../../lib/AddressUtil.sol";
import "../../lib/EIP712.sol";
import "../../thirdparty/Create2.sol";
import "../../thirdparty/ens/BaseENSManager.sol";
import "../../thirdparty/ens/ENS.sol";
import "../../thirdparty/proxy/CloneFactory.sol";
import "../base/MetaTxAware.sol";
import "../ControllerImpl.sol";


/// @title WalletFactory
/// @dev A factory contract to create a new wallet by deploying a proxy
///      in front of a real wallet.
///
/// @author Daniel Wang - <daniel@loopring.org>

contract WalletFactory
{
    using AddressUtil for address;
    using SignatureUtil for bytes32;

    event BlankDeployed (address blank,  bytes32 version);
    event BlankConsumed (address blank);
    event WalletCreated (address wallet, string ensLabel, address owner, bool blankUsed);

    string public constant WALLET_CREATION = "WALLET_CREATION";

    bytes32 public constant CREATE_WALLET_TYPEHASH = keccak256(
        "createWallet(address owner,uint256 salt,address blankAddress,string ensLabel,bool ensRegisterReverse,address[] modules)"
    );

    mapping(address => bytes32) blanks;

    address        public immutable walletImplementation;
    bool           public immutable allowEmptyENS; // MUST be false in production
    ControllerImpl public immutable controller;
    bytes32        public immutable DOMAIN_SEPERATOR;

    struct ControllerCache
    {
        address             ensResolver;
        ENSReverseRegistrar ensReverseRegistrar;
    }

    ControllerCache public controllerCache;

    BaseENSManager public immutable ensManager;

    constructor(
        ControllerImpl _controller,
        address        _walletImplementation,
        bool           _allowEmptyENS
        )
    {
        DOMAIN_SEPERATOR = EIP712.hash(
            EIP712.Domain("WalletFactory", "1.2.0", address(this))
        );
        controller = _controller;
        BaseENSManager _ensManager = _controller.ensManager();
        ensManager = _ensManager;
        _updateControllerCache(_ensManager);
        walletImplementation = _walletImplementation;
        allowEmptyENS = _allowEmptyENS;
    }

    /// @dev Create a set of new wallet blanks to be used in the future.
    /// @param modules The wallet's modules.
    /// @param salts The salts that can be used to generate nice addresses.
    function createBlanks(
        address[] calldata modules,
        uint[]    calldata salts
        )
        external
    {
        for (uint i = 0; i < salts.length; i++) {
            _createBlank(modules, salts[i]);
        }
    }

    /// @dev Create a new wallet by deploying a proxy.
    ///      This function supports tx-aware hash.
    /// @param _owner The wallet's owner.
    /// @param _salt A salt to adjust address.
    /// @param _ensLabel The ENS subdomain to register, use "" to skip.
    /// @param _ensApproval The signature for ENS subdomain approval.
    /// @param _ensRegisterReverse True to register reverse ENS.
    /// @param _modules The wallet's modules.
    /// @param _signature The wallet owner's signature.
    /// @return _wallet The new wallet address
    function createWallet(
        address            _owner,
        uint               _salt,
        string    calldata _ensLabel,
        bytes     calldata _ensApproval,
        bool               _ensRegisterReverse,
        address[] calldata _modules,
        bytes     calldata _signature
        )
        external
        payable
        returns (address _wallet)
    {
        validateRequest_(
            _owner,
            _salt,
            address(0),
            _ensLabel,
            _ensRegisterReverse,
            _modules,
            _signature
        );

        _wallet = createWallet_(_owner, _salt, _modules);

        initializeWallet_(
            _wallet,
            _owner,
            _ensLabel,
            _ensApproval,
            _ensRegisterReverse,
            false
        );
    }

    /// @dev Create a new wallet by using a pre-deployed blank.
    ///      This function supports tx-aware hash.
    /// @param _owner The wallet's owner.
    /// @param _blank The address of the blank to use.
    /// @param _ensLabel The ENS subdomain to register, use "" to skip.
    /// @param _ensApproval The signature for ENS subdomain approval.
    /// @param _ensRegisterReverse True to register reverse ENS.
    /// @param _modules The wallet's modules.
    /// @param _signature The wallet owner's signature.
    /// @return _wallet The new wallet address
    function createWallet2(
        address            _owner,
        address            _blank,
        string    calldata _ensLabel,
        bytes     calldata _ensApproval,
        bool               _ensRegisterReverse,
        address[] calldata _modules,
        bytes     calldata _signature
        )
        external
        payable
        returns (address _wallet)
    {
        validateRequest_(
            _owner,
            0,
            _blank,
            _ensLabel,
            _ensRegisterReverse,
            _modules,
            _signature
        );

        _wallet = _consumeBlank(_blank, _modules);

        initializeWallet_(
            _wallet,
            _owner,
            _ensLabel,
            _ensApproval,
            _ensRegisterReverse,
            true
        );
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
        return computeAddress_(owner, salt);
    }

    function computeBlankAddress(uint salt)
        public
        view
        returns (address)
    {
        return computeAddress_(address(0), salt);
    }

    function getWalletCreationCode()
        public
        view
        returns (bytes memory)
    {
        return CloneFactory.getByteCode(walletImplementation);
    }

    function updateControllerCache()
        public
    {
        _updateControllerCache(ensManager);
    }

    // ---- internal functions ---

    function _updateControllerCache(BaseENSManager _ensManager)
        internal
    {
        controllerCache.ensResolver = _ensManager.ensResolver();
        controllerCache.ensReverseRegistrar = _ensManager.getENSReverseRegistrar();
    }

    function _consumeBlank(
        address blank,
        address[] calldata modules
        )
        internal
        returns (address)
    {
        bytes32 version = keccak256(abi.encode(modules));
        require(blanks[blank] == version, "INVALID_ADOBE");
        delete blanks[blank];
        emit BlankConsumed(blank);
        return blank;
    }

    function _createBlank(
        address[] calldata modules,
        uint      salt
        )
        internal
        returns (address blank)
    {
        blank = _deploy(modules, address(0), salt);
        bytes32 version = keccak256(abi.encode(modules));
        blanks[blank] = version;

        emit BlankDeployed(blank, version);
    }

    function createWallet_(
        address   owner,
        uint      salt,
        address[] calldata modules
        )
        internal
        returns (address wallet)
    {
        return _deploy(modules, owner, salt);
    }

    function _deploy(
        address[] calldata modules,
        address            owner,
        uint               salt
        )
        internal
        returns (address payable wallet)
    {
        wallet = Create2.deploy(
            keccak256(abi.encodePacked(WALLET_CREATION, owner, salt)),
            CloneFactory.getByteCode(walletImplementation)
        );

        BaseWallet(wallet).init(controller, modules);
    }

    function validateRequest_(
        address            _owner,
        uint               _salt,
        address            _blankAddress,
        string    memory   _ensLabel,
        bool               _ensRegisterReverse,
        address[] memory   _modules,
        bytes     memory   _signature
        )
        private
        view
    {
        require(_owner != address(0) && !_owner.isContract(), "INVALID_OWNER");
        require(_modules.length > 0, "EMPTY_MODULES");

        bytes memory encodedRequest = abi.encode(
            CREATE_WALLET_TYPEHASH,
            _owner,
            _salt,
            _blankAddress,
            keccak256(bytes(_ensLabel)),
            _ensRegisterReverse,
            keccak256(abi.encode(_modules))
        );
        // txAwareHash replay attack is impossible because the same wallet can only be created once.
        // bytes32 txAwareHash_ = txAwareHash();
        // require(txAwareHash_ == 0 || txAwareHash_ == signHash, "INVALID_TX_AWARE_HASH");

        bytes32 signHash = EIP712.hashPacked(DOMAIN_SEPERATOR, encodedRequest);
        require(signHash.verifySignature(_owner, _signature), "INVALID_SIGNATURE");
    }

    function initializeWallet_(
        address       _wallet,
        address       _owner,
        string memory _ensLabel,
        bytes  memory _ensApproval,
        bool          _ensRegisterReverse,
        bool          _blankUsed
        )
        private
    {
        BaseWallet(_wallet.toPayable()).initOwner(_owner);

        if (bytes(_ensLabel).length > 0) {
            _registerENS(_wallet, _owner, _ensLabel, _ensApproval, _ensRegisterReverse);
        } else {
            require(allowEmptyENS, "EMPTY_ENS_NOT_ALLOWED");
        }

        emit WalletCreated(_wallet, _ensLabel, _owner, _blankUsed);
    }

    function computeAddress_(
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
            bytes(ensApproval).length > 0,
            "INVALID_LABEL_OR_SIGNATURE"
        );

        ensManager.register(wallet, owner, ensLabel, ensApproval);

        if (ensRegisterReverse) {
            bytes memory data = abi.encodeWithSelector(
                ENSReverseRegistrar.claimWithResolver.selector,
                address(0), // the owner of the reverse record
                controllerCache.ensResolver
            );

            Wallet(wallet).transact(
                uint8(1),
                address(controllerCache.ensReverseRegistrar),
                0, // value
                data
            );
        }
    }
}
