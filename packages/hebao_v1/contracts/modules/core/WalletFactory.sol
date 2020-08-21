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
contract WalletFactory is ReentrancyGuard
{
    using AddressUtil for address;
    using SignatureUtil for bytes32;

    event AdobeDeployed (address adobe,  bytes32 version);
    event WalletCreated (address wallet, string ensLabel, address owner);

    string constant public PREFIX_WALLET_CREATION = "WALLET_CREATION";
    string constant public PREFIX_ADOBE_CREATION  = "ADOBE_CREATION";

    mapping(address => bytes32) adobes;

    address        public walletImplementation;
    ControllerImpl public controller;

    bytes32 public DOMAIN_SEPERATOR;
    bytes32 public constant CREATE_WALLET_TYPEHASH = keccak256(
        "createWallet(address owner,string ensLabel,bytes ensApproval,address[] modules)"
    );

    constructor(
        ControllerImpl _controller,
        address        _walletImplementation
        )
    {
        DOMAIN_SEPERATOR = EIP712.hash(
            EIP712.Domain("WalletFactory", "1.1.0", address(this))
        );
        controller = _controller;
        walletImplementation = _walletImplementation;
    }

    /// @dev Create a set of new wallet adobes to be used in the future.
    /// @param implementation The wallet's implementation.
    /// @param modules The wallet's modules.
    /// @param salts The salts that can be used to generate nice addresses.
    function createAdobes(
        address   implementation,
        address[] calldata modules,
        uint[]    calldata salts
        )
        external
    {
        for (uint i = 0; i < salts.length; i++) {
            createAdobe_(implementation, modules, salts[i]);
        }
    }

    /// @dev Create a new wallet by deploying a proxy.
    /// @param _owner The wallet's owner.
    /// @param _ensLabel The ENS subdomain to register, use "" to skip.
    /// @param _ensApproval The signature for ENS subdomain approval.
    /// @param _modules The wallet's modules.
    /// @param _signature The wallet owner's signature.
    /// @param _adobe The uninitialized wallet address to use
    /// @return _wallet The new wallet address
    function createWallet(
        address            _owner,
        string    calldata _ensLabel,
        bytes     calldata _ensApproval,
        address[] calldata _modules,
        bytes     calldata _signature,
        address            _adobe
        )
        external
        payable
        returns (address _wallet)
    {
        {   // Avoid stack too deep
            require(_owner != address(0) && !_owner.isContract(), "INVALID_OWNER");
            require(_modules.length > 0, "EMPTY_MODULES");

            bytes memory encodedRequest = abi.encode(
                CREATE_WALLET_TYPEHASH,
                _owner,
                keccak256(bytes(_ensLabel)),
                keccak256(_ensApproval),
                keccak256(abi.encode(_modules))
            );

            require(
                EIP712.hashPacked(DOMAIN_SEPERATOR, encodedRequest)
                    .verifySignature(_owner, _signature),
                "INVALID_SIGNATURE"
            );
        }

        _wallet = _adobe == address(0)?
            createWallet_(_owner, _modules) :
            consumeAdobe_(_adobe, _modules);

        BaseWallet(_wallet.toPayable()).initialize(address(controller), _owner);

        if (bytes(_ensLabel).length > 0) {
            registerENS_(_wallet, _ensLabel, _ensApproval);
        }

        emit WalletCreated(_wallet, _ensLabel, _owner);
    }

    function registerENS(
        string calldata _ensLabel,
        bytes  calldata _ensApproval
        )
        external
    {
        registerENS_(msg.sender, _ensLabel, _ensApproval);
    }

    function computeWalletAddress(address owner)
        public
        view
        returns (address)
    {
        return computeAddress_(PREFIX_WALLET_CREATION, uint(owner));
    }

    function computeAdobeAddress(uint salt)
        public
        view
        returns (address)
    {
        return computeAddress_(PREFIX_ADOBE_CREATION, salt);
    }

    // ---- internal functions ---

    function consumeAdobe_(
        address adobe,
        address[] calldata modules
        )
        internal
        returns (address)
    {
        bytes32 version = keccak256(abi.encode(walletImplementation, modules));
        require(adobes[adobe] == version, "INVALID_ADOBE");
        delete adobes[adobe];
        return adobe;
    }

    function createAdobe_(
        address   implementation,
        address[] calldata modules,
        uint      salt
        )
        internal
        returns (address adobe)
    {
        adobe = deploy_(PREFIX_ADOBE_CREATION, implementation, modules, salt);
        bytes32 version = keccak256(abi.encode(implementation, modules));
        adobes[adobe] = version;

        emit AdobeDeployed(adobe, version);
    }

    function createWallet_(
        address   owner,
        address[] calldata modules
        )
        internal
        returns (address wallet)
    {
        return deploy_(PREFIX_WALLET_CREATION, walletImplementation, modules, uint(owner));
    }

    function deploy_(
        string    memory   prefix,
        address            implementation,
        address[] calldata modules,
        uint               salt
        )
        internal
        returns (address wallet)
    {
        bytes32 salt_ = keccak256(abi.encodePacked(prefix, salt));
        wallet = Create2.deploy(salt_, type(SimpleProxy).creationCode);

        SimpleProxy proxy = SimpleProxy(wallet.toPayable());
        proxy.setImplementation(implementation);

        Wallet w = Wallet(wallet);
        for (uint i = 0; i < modules.length; i++) {
            w.addModule(modules[i]);
        }
    }

    function computeAddress_(
        string memory prefix,
        uint          salt
        )
        internal
        view
        returns (address)
    {
        return Create2.computeAddress(
            keccak256(abi.encodePacked(prefix, salt)),
            type(SimpleProxy).creationCode
        );
    }

    function registerENS_(
        address       wallet,
        string memory ensLabel,
        bytes  memory ensApproval
        )
        internal
    {
        require(
            bytes(ensLabel).length > 0 &&
            bytes(ensApproval).length > 0,
            "INVALID_LABEL_OR_SIGNATURE"
        );

        BaseENSManager ensManager = controller.ensManager();
        ensManager.register(wallet, ensLabel, ensApproval);

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
}
