// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../iface/Module.sol";
import "../iface/Wallet.sol";
import "../lib/ERC20.sol";
import "../lib/ReentrancyGuard.sol";
import "./Controller.sol";


/// @title BaseWallet
/// @dev This contract provides basic implementation for a Wallet.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
abstract contract BaseWallet is ReentrancyGuard, Wallet
{
    address internal _owner;

    mapping (address => bool) private modules;

    Controller public controller;

    mapping (bytes4  => address) internal methodToModule;

    event OwnerChanged          (address newOwner);
    event ControllerChanged     (address newController);
    event ModuleAdded           (address module);
    event ModuleRemoved         (address module);
    event MethodBound           (bytes4  method, address module);
    event WalletSetup           (address owner);

    event Transacted(
        address module,
        address to,
        uint    value,
        bytes   data
    );

    modifier onlyFromModule
    {
        require(modules[msg.sender], "MODULE_UNAUTHORIZED");
        _;
    }

    /// @dev We need to make sure the Factory address cannot be changed without wallet owner's
    ///      explicit authorization.
    modifier onlyFromFactoryOrModule
    {
        require(
            msg.sender == controller.walletFactory() || modules[msg.sender],
            "UNAUTHORIZED"
        );
        _;
    }

    function owner()
        override
        external
        view
        returns (address)
    {
        return _owner;
    }

    function setOwner(address newOwner)
        external
        override
        nonReentrant
        onlyFromModule
    {
        require(newOwner != address(0), "ZERO_ADDRESS");
        require(newOwner != address(this), "PROHIBITED");
        require(newOwner != _owner, "SAME_ADDRESS");
        _owner = newOwner;
        emit OwnerChanged(newOwner);
    }

    function setController(Controller newController)
        external
        nonReentrant
        onlyFromModule
    {
        require(newController != controller, "SAME_CONTROLLER");
        require(newController != Controller(0), "INVALID_CONTROLLER");
        controller = newController;
        emit ControllerChanged(address(newController));
    }

    function setup(
        address _controller,
        address initialOwner
        )
        external
        override
        nonReentrant
    {
        require(_owner == address(0), "INITIALIZED_ALREADY");
        require(initialOwner != address(0), "ZERO_ADDRESS");

        controller = Controller(_controller);
        _owner = initialOwner;

        emit WalletSetup(_owner);
    }

    function addModule(address _module)
        external
        override
        onlyFromFactoryOrModule
    {
        addModuleInternal(_module);
    }

    function removeModule(address _module)
        external
        override
        onlyFromModule
    {
        // Allow deactivate to fail to make sure the module can be removed
        require(modules[_module], "MODULE_NOT_EXISTS");
        try Module(_module).deactivate() {} catch {}
        delete modules[_module];
        emit ModuleRemoved(_module);
    }

    function hasModule(address _module)
        external
        view
        override
        returns (bool)
    {
        return modules[_module];
    }

    function bindMethod(bytes4 _method, address _module)
        external
        override
        onlyFromModule
    {
        require(_method != bytes4(0), "BAD_METHOD");
        if (_module != address(0)) {
            require(methodToModule[_method] == address(0), "METHOD_BOUND_ALREADY");
            require(modules[_module], "MODULE_UNAUTHORIZED");
        }

        methodToModule[_method] = _module;
        emit MethodBound(_method, _module);
    }

    function boundMethodModule(bytes4 _method)
        external
        view
        override
        returns (address)
    {
        return methodToModule[_method];
    }

    function transact(
        uint8    mode,
        address  to,
        uint     value,
        bytes    calldata data
        )
        external
        override
        onlyFromFactoryOrModule
        returns (bytes memory returnData)
    {
        require(
            !controller.moduleRegistry().isModuleRegistered(to),
            "TRANSACT_ON_MODULE_DISALLOWED"
        );

        bool success;
        (success, returnData) = nonReentrantCall(mode, to, value, data);

        if (!success) {
            assembly {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
        emit Transacted(msg.sender, to, value, data);
    }

    function addModuleInternal(address _module)
        internal
    {
        require(_module != address(0), "NULL_MODULE");
        require(modules[_module] == false, "MODULE_EXISTS");
        require(
            controller.moduleRegistry().isModuleEnabled(_module),
            "INVALID_MODULE"
        );
        modules[_module] = true;
        emit ModuleAdded(_module);
        Module(_module).activate();
    }

    receive()
        external
        payable
    {
    }

    /// @dev This default function can receive Ether or perform queries to modules
    ///      using bound methods.
    fallback()
        external
        payable
    {
        address module = methodToModule[msg.sig];
        require(modules[module], "MODULE_UNAUTHORIZED");

        (bool success, bytes memory returnData) = module.call{value: msg.value}(msg.data);
        assembly {
            switch success
            case 0 { revert(add(returnData, 32), mload(returnData)) }
            default { return(add(returnData, 32), mload(returnData)) }
        }
    }

    // This call is introduced to support reentrany check.
    // The caller shall NOT have the nonReentrant modifier.
    function nonReentrantCall(
        uint8        mode,
        address      target,
        uint         value,
        bytes memory data
        )
        private
        nonReentrant
        returns (
            bool success,
            bytes memory returnData
        )
    {
        if (mode == 1) {
            // solium-disable-next-line security/no-call-value
            (success, returnData) = target.call{value: value}(data);
        } else if (mode == 2) {
            // solium-disable-next-line security/no-call-value
            (success, returnData) = target.delegatecall(data);
        } else if (mode == 3) {
            require(value == 0, "INVALID_VALUE");
            // solium-disable-next-line security/no-call-value
            (success, returnData) = target.staticcall(data);
        } else {
            revert("UNSUPPORTED_MODE");
        }
    }
}
