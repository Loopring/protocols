// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../../iface/Module.sol";
import "../../iface/Wallet.sol";
import "../../lib/OwnerManagable.sol";
import "../../lib/ReentrancyGuard.sol";
import "../../lib/AddressUtil.sol";
import "../../lib/EIP712.sol";
import "../../thirdparty/Create2.sol";
import "../../thirdparty/ens/BaseENSManager.sol";
import "../../thirdparty/ens/ENS.sol";
import "../../thirdparty/OwnedUpgradabilityProxy.sol";
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

    event WalletCreated(
        address indexed wallet,
        address indexed owner
    );

    address        public walletImplementation;
    bool           public allowEmptyENS;
    ControllerImpl public controller;

    bytes32 public DOMAIN_SEPERATOR;
    bytes32 public constant CREATE_WALLET_TYPEHASH = keccak256(
        "createWallet(address owner,string label,bytes labelApproval,address[] modules)"
    );

    constructor(
        ControllerImpl _controller,
        address        _walletImplementation,
        bool           _allowEmptyENS
        )
        public
    {
        DOMAIN_SEPERATOR = EIP712.hash(
            EIP712.Domain("WalletFactory", "1.1.0", address(this))
        );
        controller = _controller;
        walletImplementation = _walletImplementation;
        allowEmptyENS = _allowEmptyENS;
    }

    function computeWalletAddress(
        address owner
        )
        public
        view
        returns (address)
    {
        return Create2.computeAddress(
            getSalt(owner),
            getWalletCode()
        );
    }

    /// @dev Create a new wallet by deploying a proxy.
    /// @param _owner The wallet's owner.
    /// @param _label The ENS subdomain to register, use "" to skip.
    /// @param _labelApproval The signature for ENS subdomain approval.
    /// @param _modules The wallet's modules.
    /// @param _signature The wallet owner's signature.
    function createWallet(
        address            _owner,
        string    calldata _label,
        bytes     calldata _labelApproval,
        address[] calldata _modules,
        bytes     calldata _signature
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
            keccak256(bytes(_label)),
            keccak256(_labelApproval),
            keccak256(abi.encode(_modules))
        );

        bytes32 txHash = EIP712.hashPacked(DOMAIN_SEPERATOR, encodedRequest);
        require(txHash.verifySignature(_owner, _signature), "INVALID_SIGNATURE");

        _wallet = createWalletInternal(walletImplementation, _owner);

        Wallet w = Wallet(_wallet);
        for(uint i = 0; i < _modules.length; i++) {
            w.addModule(_modules[i]);
        }

        // register ENS
        address ensManager = controller.ensManagerAddress();

        if (ensManager != address(0)) {
            if (bytes(_label).length > 0) {
                registerENS(
                    _wallet,
                    BaseENSManager(ensManager),
                    _label,
                    _labelApproval
                );
            } else {
                require(allowEmptyENS, "INVALID_ENS_LABEL");
            }
        }
    }

    function registerENS(
        address        wallet,
        BaseENSManager ensManager,
        string memory  label,
        bytes  memory  labelApproval
        )
        internal
    {
        ensManager.register(wallet, label, labelApproval);

        bytes memory data = abi.encodeWithSelector(
            ENSReverseRegistrar(0).claimWithResolver.selector,
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

    function createWalletInternal(
        address    _implementation,
        address    _owner
        )
        internal
        returns (address payable _wallet)
    {
        // Deploy the wallet
        _wallet = Create2.deploy(getSalt(_owner), getWalletCode());

        OwnedUpgradabilityProxy(_wallet).upgradeTo(_implementation);
        OwnedUpgradabilityProxy(_wallet).transferProxyOwnership(_wallet);

        Wallet(_wallet).setup(address(controller), _owner);

        controller.walletRegistry().registerWallet(_wallet);

        emit WalletCreated(_wallet, _owner);
    }

    function getSalt(
        address owner
        )
        internal
        pure
        returns (bytes32 salt)
    {
        return keccak256(abi.encodePacked("WALLET_CREATION", owner));
    }

    function getWalletCode()
        internal
        pure
        returns (bytes memory)
    {
        return type(OwnedUpgradabilityProxy).creationCode;
    }
}
