// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../iface/IVersion.sol";
import "../iface/IVersionRegistry.sol";
import "../iface/IWallet.sol";
import "../lib/ERC20.sol";
import "../lib/EIP712.sol";
import "./WalletDataLayout.sol";


/// @title BaseWallet
/// @dev This contract provides basic implementation for a Wallet.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract Wallet is IWallet, WalletDataLayout
{
    address public override immutable versionRegistry;

    event VersionChanged(address prevVersion, address newVersion);

    modifier isValidVersion(address version)
    {
        require(
            IVersionRegistry(versionRegistry).getVersionNumber(version) > 0,
            "INVALID_VERSION_ADDRESS"
        );
        _;
    }

    modifier isDelegatable()
    {
        address _module = _getBindingModule(msg.sig);
        if (_module != address(0)) {
            _delegateTo(_module);
        } else {
            _;
        }
    }

    constructor(address _versionRegistry)
    {
        versionRegistry = _versionRegistry;
    }

    function domainSeperator()
        public
        override
        view
        returns (bytes32)
    {
        string memory label = IVersion(version()).label();
        return EIP712.hash(EIP712.Domain("Loopring Wallet", label, address(this)));
    }

    function owner() public override view returns (address) { return state.owner; }
    function version() public override view returns (address) { return state.version; }

    function setVersion(address newVersion)
        external
        override
        isValidVersion(newVersion)
        isDelegatable
    {
        address _version = version();
        require(_version == address(0), "INITIALIZED_ALREADY");
        state.version = _version;
        emit VersionChanged(_version, newVersion);


        bytes4 migrateSelector = bytes4(keccak256("migrate(address,address)"));
        address _module = _getBindingModule(migrateSelector);
        if (_module != address(0)) {
            _module.delegatecall(abi.encodePacked(migrateSelector, _version, newVersion));
        }
    }

    receive() external payable {}

    fallback()
        external
        payable
    {
        address _module = _getBindingModule(msg.sig);
        require(_module != address(0), "NO_BINDING_FOUND");
        _delegateTo(_module);
    }

    function _delegateTo(address module)
        internal
    {
        (bool success, bytes memory returnData) = module.delegatecall(msg.data);
        assembly {
            switch success
            case 0 { revert(add(returnData, 32), mload(returnData)) }
            default { return(add(returnData, 32), mload(returnData)) }
        }
    }

    function _getBindingModule(bytes4 selector)
        internal
        view
        returns (address)
    {
        address _version = version();
        if (_version == address(0)) {
            return address(0);
        } else {
            return IVersion(_version).getBindingTarget(selector);
        }
    }
}
