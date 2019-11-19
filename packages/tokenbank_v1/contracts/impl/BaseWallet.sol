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
pragma solidity ^0.5.11;

import "../lib/ERC20.sol";
import "../lib/NamedAddressSet.sol";
import "../lib/ReentrancyGuard.sol";

import "../iface/BankRegistry.sol";
import "../iface/Wallet.sol";
import "../iface/Module.sol";


/// @title BaseWallet
/// @dev This contract provides basic implementation for a Wallet.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract BaseWallet is Wallet, NamedAddressSet, ReentrancyGuard
{
    address internal _owner;

    string internal constant MODULE = "__MODULE__";
    string internal constant ERC20_TRANSFER = "transfer(address,uint256)";

    BankRegistry public bankRegistry;

    mapping (bytes4  => address) internal methodToModule;

    /// @dev Emitted when the wallet received Ether.
    event Received(
        address indexed sender,
        uint    value,
        bytes   data
    );

    modifier onlyOwner
    {
        require(msg.sender == _owner, "NOT_A_OWNER");
        _;
    }

    modifier onlyModule
    {
        require(isAddressInSet(MODULE, msg.sender), "MODULE_UNAUTHORIZED");
        require(bankRegistry.isModuleRegistered(msg.sender), "INVALID_MODULE");
        _;
    }

    constructor(BankRegistry _bankRegistry) public {
        bankRegistry = _bankRegistry;
    }

    function setup(
        address   owner,
        address[] calldata modules
        )
        external
        nonReentrant
    {
        require(_owner == address(0) && numAddressesInSet(MODULE) == 0, "INITIALIZED_ALREADY");
        require(owner != address(0), "ZERO_ADDRESS");
        require(modules.length > 0, "EMPTY_MODULES");

        _owner = owner;
        bankRegistry.registerWallet(address(this));
        emit WalletSetup(_owner);

        for(uint i = 0; i < modules.length; i++) {
            addModuleInternal(modules[i]);
        }
    }

    function addModule(address _module)
        external
        onlyModule
        nonReentrant
    {
        addModuleInternal(_module);
    }

    function addModuleInternal(address _module)
        internal
    {
        require(_module != address(0), "NULL_MODULE");
        require(bankRegistry.isModuleRegistered(_module), "INVALID_MODULE");

        addAddressToSet(MODULE, _module, true);
        Module(_module).initialize(address(this));
        emit ModuleAdded(_module);
    }

    function removeModule(address _module)
        external
        onlyModule
        nonReentrant
    {
        require(numAddressesInSet(MODULE) > 1, "PROHIBITED");
        Module(_module).terminate(address(this));
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

    function bindStaticMethod(bytes4 _method, address _module)
        external
        onlyModule
        nonReentrant
    {
        require(_method != bytes4(0), "BAID_METHOD");
        require(
            _module == address(0) || methodToModule[_method] == address(0),
            "BAD_MODULE"
        );

        methodToModule[_method] = _module;
        emit StaticMethodBound(_method, _module);
    }

    function staticMethodModule(bytes4 _method)
        public
        view
        returns (address)
    {
        return methodToModule[_method];
    }

    function tokenBalance(address token)
        public
        view
        returns (uint)
    {
        if (token == address(0)) {
            return address(this).balance;
        } else {
            return ERC20(token).balanceOf(address(this));
        }
    }

    function transferToken(
        address to,
        uint    value,
        address token
        )
        external
        onlyModule
        nonReentrant
        returns (bool success)
    {
        require(to != address(this), "SAME_ADDRESS");
        bytes memory result;
        if (token == address(0)) {
            result = transactInternal(to, value, "");
        } else {
            bytes memory data = abi.encodeWithSignature(ERC20_TRANSFER, to, value);
            result = transactInternal(token, 0, data);
        }

        // TODO(daniel): Not sure if this will work, this need to be tested!!!
        if (result.length == 0) {
            return true;
        }

        if (result.length == 32) {
            assembly { success := mload(add(result, 32)) }
        }
    }

    function transact(
        address to,
        uint    value,
        bytes   calldata data
        )
        external
        onlyModule
        nonReentrant
        returns (bytes memory result)
    {
        return transactInternal(to, value, data);
    }

    function transactInternal(
        address to,
        uint    value,
        bytes   memory data
        )
        private
        returns (bytes memory result)
    {
        bool success;
        // solium-disable-next-line security/no-call-value
        (success, result) = to.call.value(value)(data);
        if (!success) {
            assembly {
                returndatacopy(0, 0, returndatasize)
                revert(0, returndatasize)
            }
        }
        emit Transacted(msg.sender, to, value, data);
    }

    /// @dev This default function can receive Ether or perform queris to modules
    ///      using staticly bound methods.
    function()
        external
        payable
    {
        if (msg.value > 0) {
            emit Received(msg.sender, msg.value, msg.data);
            return;
        }

        if (msg.data.length == 0) {
            return;
        }

        address module = methodToModule[msg.sig];
        require(isAddressInSet(MODULE, module), "MODULE_UNAUTHORIZED");
        require(bankRegistry.isModuleRegistered(module), "INVALID_MODULE");

        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, 0, calldatasize())
            let result := staticcall(gas, module, ptr, calldatasize(), 0, 0)
            returndatacopy(ptr, 0, returndatasize())

            switch result
            case 0 { revert(ptr, returndatasize()) }
            default { return(ptr, returndatasize()) }
        }
    }
}