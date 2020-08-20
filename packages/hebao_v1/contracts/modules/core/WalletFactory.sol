// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../base/BaseWallet.sol";
import "../../iface/Module.sol";
import "../../iface/Wallet.sol";
import "../../lib/OwnerManagable.sol";
import "../../lib/SimpleProxy.sol";
import "../../lib/ReentrancyGuard.sol";
import "../../lib/AddressUtil.sol";
import "../../lib/EIP712.sol";
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
contract WalletFactory is ReentrancyGuard
{
    using AddressUtil for address;
    using SignatureUtil for bytes32;

    event AdobeCreated (address wallet, bytes32 version);
    event WalletCreated(address wallet, address owner);

    mapping(address => bytes32) adobes;

    address        public walletImplementation;
    bool           public allowEmptyENS;
    ControllerImpl public controller;

    bytes32 public DOMAIN_SEPERATOR;
    bytes32 public constant CREATE_WALLET_TYPEHASH = keccak256(
        "createWallet(address owner,string ensLabel,bytes ensApproval,bool ensRegisterReverse,address[] modules)"
    );

    constructor(
        ControllerImpl _controller,
        address        _walletImplementation,
        bool           _allowEmptyENS
        )
    {
        DOMAIN_SEPERATOR = EIP712.hash(
            EIP712.Domain("WalletFactory", "1.1.0", address(this))
        );
        controller = _controller;
        walletImplementation = _walletImplementation;
        allowEmptyENS = _allowEmptyENS;
    }


    /// @dev Create a new wallet adobe to be used in the future.
    /// @param _implementation The wallet's implementation.
    /// @param _modules The wallet's modules.
    /// @param _adobe The uninitialized wallet address to use
    function createAdobe(
        address   _implementation,
        address[] calldata _modules
        )
        external
        returns (address _adobe)
    {
        return createAdobeInternal(_implementation, _modules, true);
    }


    /// @dev Create a new wallet adobe using the current implementation.
    ///      The adobe will be used in the future.
    /// @param _modules The wallet's modules.
    /// @param _adobe The uninitialized wallet address to use
    function createAdobe(
        address[] calldata _modules
        )
        external
        returns (address _adobe)
    {
        return createAdobeInternal(walletImplementation, _modules, true);
    }

    /// @dev Create a new wallet by deploying a proxy.
    /// @param _owner The wallet's owner.
    /// @param _ensLabel The ENS subdomain to register, use "" to skip.
    /// @param _ensApproval The signature for ENS subdomain approval.
    /// @param _ensRegisterReverse True to register reverse ENS.
    /// @param _modules The wallet's modules.
    /// @param _signature The wallet owner's signature.
    /// @param _adobe The uninitialized wallet address to use
    /// @return _wallet The new wallet address
    function createWallet(
        address            _owner,
        string    calldata _ensLabel,
        bytes     calldata _ensApproval,
        bool               _ensRegisterReverse,
        address[] calldata _modules,
        bytes     calldata _signature,
        address            _adobe
        )
        external
        payable
        returns (address _wallet)
    {
        require(_owner != address(0) && !_owner.isContract(), "INVALID_OWNER");
        require(_modules.length > 0, "EMPTY_MODULES");

        bytes memory encodedRequest = abi.encode(
            CREATE_WALLET_TYPEHASH,
            _owner,
            keccak256(bytes(_ensLabel)),
            keccak256(_ensApproval),
            _ensRegisterReverse,
            keccak256(abi.encode(_modules))
        );

        require(
            EIP712.hashPacked(DOMAIN_SEPERATOR, encodedRequest)
                .verifySignature(_owner, _signature),
            "INVALID_SIGNATURE"
        );

        if (_adobe == address(0)) {
            _wallet= createAdobeInternal(walletImplementation, _modules, false);
        } else {
            require(
                adobes[_adobe] == keccak256(abi.encode(walletImplementation, _modules)),
                "INVALID_ADOBE"
            );
            delete adobes[_adobe];
            _wallet = _adobe;
        }

        BaseWallet(_wallet.toPayable()).initialize(address(controller), _owner);

        if (bytes(_ensLabel).length > 0) {
            registerENS(_wallet, _ensLabel, _ensApproval);

            if (_ensRegisterReverse) {
                registerReverseENSInternal(_wallet);
            }
        } else {
            require(allowEmptyENS, "INVALID_ENS_LABEL");
        }

        emit WalletCreated(_wallet, _owner);
    }

    function registerENS(
        address        wallet,
        string memory  label,
        bytes  memory  labelApproval
        )
        public
    {
        require(
            bytes(label).length > 0 &&
            bytes(labelApproval).length > 0,
            "INVALID_LABEL_OR_SIG"
        );

        BaseENSManager ensManager = controller.ensManager();
        require(address(ensManager) != address(0), "NO_EMS_MANAGER");

        ensManager.register(wallet, label, labelApproval);
    }

    function registerReverseENS()
        public
    {
        registerReverseENSInternal(msg.sender);
    }

    // ---- internal functions ---

    function registerReverseENSInternal(
        address wallet
        )
        internal
    {
        BaseENSManager ensManager = controller.ensManager();
        require(address(ensManager) != address(0), "NO_EMS_MANAGER");

        bytes memory data = abi.encodeWithSelector(
            ENSReverseRegistrar.claimWithResolver.selector,
            address(0), // the owner of the reverse record
            ensManager.ensResolver()
        );

        Wallet(wallet).transact(
            uint8(1),
            address(ensManager.getENSReverseRegistrar()),
            0, // value
            data
        );
    }

    function createAdobeInternal(
        address   implementation,
        address[] calldata modules,
        bool      register
        )
        internal
        returns (address adobe)
    {
        SimpleProxy proxy = new SimpleProxy();
        proxy.setImplementation(implementation);

        adobe = address(proxy);

        Wallet w = Wallet(adobe);
        for(uint i = 0; i < modules.length; i++) {
            w.addModule(modules[i]);
        }

        if (register) {
            bytes32 version = keccak256(abi.encode(implementation, modules));
            adobes[adobe] = version;
            emit AdobeCreated(adobe, version);
        }
    }
}
