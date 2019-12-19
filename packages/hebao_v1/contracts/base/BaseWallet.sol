/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity ^0.5.13;

import "../lib/ERC20.sol";
import "../lib/AddressSet.sol";
import "../lib/ReentrancyGuard.sol";

import "../iface/Controller.sol";
import "../iface/Module.sol";
import "../iface/Wallet.sol";


/// @title BaseWallet
/// @dev This contract provides basic implementation for a Wallet.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract BaseWallet is ReentrancyGuard, AddressSet, Wallet
{
    address internal _owner;

    bytes32 internal constant MODULE = keccak256("__MODULE__");

    Controller public controller;

    mapping (bytes4  => address) internal methodToModule;

    event OwnerChanged          (address indexed newOwner);
    event ModuleAdded           (address indexed module);
    event ModuleRemoved         (address indexed module);
    event MethodBound           (bytes4  indexed method, address indexed module);

    event WalletSetup(address indexed owner);

    event Transacted(
        address indexed module,
        address indexed to,
        uint            value,
        bytes           data
    );

    modifier onlyOwner
    {
        require(msg.sender == _owner, "NOT_A_OWNER");
        _;
    }

    modifier onlyModule
    {
        require(isAddressInSet(MODULE, msg.sender), "MODULE_UNAUTHORIZED");
        _;
    }

    modifier onlyOwnerOrModule
    {
        require(
            msg.sender == _owner || isAddressInSet(MODULE, msg.sender),
            "MODULE_UNAUTHORIZED"
        );
        _;
    }

    function owner() public view returns (address)
    {
        return _owner;
    }

    function setOwner(address newOwner)
        external
        onlyModule
    {
        require(newOwner != address(0), "ZERO_ADDRESS");
        require(newOwner != address(this), "PROHIBITED");
        require(newOwner != _owner, "SAME_ADDRESS");
        _owner = newOwner;
        emit OwnerChanged(newOwner);
    }

    function setup(
        address _controller,
        address initialOwner,
        address[] calldata modules
        )
        external
        nonReentrant
    {
        require(
            _owner == address(0) && numAddressesInSet(MODULE) == 0,
            "INITIALIZED_ALREADY"
        );
        require(initialOwner != address(0), "ZERO_ADDRESS");
        require(modules.length > 0, "EMPTY_MODULES");

        controller = Controller(_controller);
        _owner = initialOwner;
        controller.walletRegistry().registerWallet(address(this));
        emit WalletSetup(_owner);

        for(uint i = 0; i < modules.length; i++) {
            addModuleInternal(modules[i]);
        }
    }

    function addModule(address _module)
        external
        onlyOwnerOrModule
    {
        addModuleInternal(_module);
    }

    function removeModule(address _module)
        external
        onlyModule
    {
        require(numAddressesInSet(MODULE) > 1, "PROHIBITED");
        Module(_module).deactivate();
        removeAddressFromSet(MODULE, _module);
        emit ModuleRemoved(_module);
    }

    function modules()
        public
        view
        returns (address[] memory)
    {
        return addressesInSet(MODULE);
    }

    function hasModule(address _module)
        public
        view
        returns (bool)
    {
        return isAddressInSet(MODULE, _module);
    }

    function bindMethod(bytes4 _method, address _module)
        external
        onlyModule
    {
        require(_method != bytes4(0), "BAD_METHOD");
        require(methodToModule[_method] == address(0), "METHOD_BOUND_ALREADY");
        require(isAddressInSet(MODULE, _module), "MODULE_UNAUTHORIZED");

        methodToModule[_method] = _module;
        emit MethodBound(_method, _module);
    }

    function boundMethodModule(bytes4 _method)
        public
        view
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
        onlyModule
        returns (bytes memory result)
    {
        require(
            !controller.moduleRegistry().isModuleRegistered(to),
            "TRANSACT_ON_MODULE_DISALLOWED"
        );

        bool success;
        if (mode == 1) {
            // solium-disable-next-line security/no-call-value
            (success, result) = to.call.value(value)(data);
        } else if (mode == 2) {
            // solium-disable-next-line security/no-call-value
            (success, result) = to.delegatecall(data);
        } else if (mode == 3) {
            require(value == 0, "INVALID_VALUE");
            // solium-disable-next-line security/no-call-value
            (success, result) = to.staticcall(data);
        } else {
            revert("UNSUPPORTED_MODE");
        }

        if (!success) {
            assembly {
                returndatacopy(0, 0, returndatasize)
                revert(0, returndatasize)
            }
        }
        emit Transacted(msg.sender, to, value, data);
    }

    function addModuleInternal(address _module)
        internal
    {
        require(_module != address(0), "NULL_MODULE");
        require(
            controller.moduleRegistry().isModuleRegistered(_module),
            "INVALID_MODULE"
        );

        addAddressToSet(MODULE, _module, true);
        Module(_module).activate();
        emit ModuleAdded(_module);
    }

    /// @dev This default function can receive Ether or perform queries to modules
    ///      using bound methods.
    function()
        external
        payable
    {
        if (msg.data.length == 0 || msg.value > 0) {
            // Note: don't do anything here so send/transfer still works
            // -- the 2300 gas limit for send/transfer may case out-of-gas
            // issue after Istanbul.
            return;
        }

        address module = methodToModule[msg.sig];
        require(isAddressInSet(MODULE, module), "MODULE_UNAUTHORIZED");

        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, 0, calldatasize())
            let result := call(gas, module, 0, ptr, calldatasize(), 0, 0)
            returndatacopy(ptr, 0, returndatasize())

            switch result
            case 0 { revert(ptr, returndatasize()) }
            default { return(ptr, returndatasize()) }
        }
    }

    function isLocalMethod(bytes4 _method)
        private
        pure
        returns (bool)
    {
        return _method == this.owner.selector ||
            _method == this.modules.selector ||
            _method == this.hasModule.selector ||
            _method == this.boundMethodModule.selector;
    }
}
