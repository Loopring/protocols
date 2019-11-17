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

import "../iface/Wallet.sol";
import "../iface/Module.sol";

import "../lib/ERC20.sol";
import "../lib/NamedAddressSet.sol";
import "../lib/ReentrancyGuard.sol";

// The concept/design of this class is inspired by Argent's contract codebase:
// https://github.com/argentlabs/argent-contracts


contract BaseWallet is Wallet, NamedAddressSet, ReentrancyGuard
{
    string private constant MODULE = "__MODULE__";
    string private constant ERC20_TRANSFER = "transfer(address,uint256)";

    mapping (bytes4  => address) internal getters;

    event Received(
        address indexed sender,
        uint    value,
        bytes   data
    );

    modifier onlyOwner
    {
        require(msg.sender == owner, "NOT_A_OWNER");
        _;
    }

    modifier onlyModule
    {
        require(isAddressInSet(MODULE, msg.sender), "NOT_A_MODULE");
        _;
    }

    function init(
        address            _owner,
        address[] calldata _modules
        )
        external
        nonReentrant
    {
        require(owner == address(0) && numAddressesInSet(MODULE) == 0, "INITIALIZED_ALREADY");
        require(_owner != address(0), "ZERO_ADDRESS");
        require(_modules.length > 0, "EMPTY_MODULES");

        owner = _owner;
        emit Initialized(owner);

        for(uint i = 0; i < _modules.length; i++) {
            address module = _modules[i];
            require(module != address(0), "NULL_MODULE");
            addAddressToSet(MODULE, module);
            Module(module).init(address(this));
            emit ModuleAdded(module);
        }
    }

    function addModule(address _module)
        external
        onlyModule
        nonReentrant
    {
        require(_module != address(0), "NULL_MODULE");
        addAddressToSet(MODULE, _module);
        Module(_module).init(address(this));
        emit ModuleAdded(_module);
    }

    function removeModule(address _module)
        external
        onlyModule
        nonReentrant
    {
        require(numAddressesInSet(MODULE) > 1, "PROHIBITED");
        removeAddressFromSet(MODULE, _module);
        emit ModuleRemoved(_module);
    }

    function getModules()
        public
        view
        returns (address[] memory)
    {
        return getAddressesInSet(MODULE);
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
        getters[_method] = _module;
        emit GetterBinded(_method, _module);
    }

    function staticMethodModule(bytes4 _method)
        public
        view
        returns (address)
    {
        return getters[_method];
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
        bytes memory result;
        if (token == address(0)) {
            result = transactInternal(to, value, "");
        } else {
            bytes memory data = abi.encodeWithSignature(ERC20_TRANSFER, to, value);
            result = transactInternal(token, 0, data);
        }

        // TODO(daniel): This need to be tested
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
        (success, result) = to.call.value(value)(data);
        if (!success) {
            assembly {
                returndatacopy(0, 0, returndatasize)
                revert(0, returndatasize)
            }
        }
        emit Transacted(msg.sender, to, value, data);
    }

    function()
        external
        payable
    {
        address module = msg.data.length == 0 ? address(0) : getters[msg.sig];

        if (module == address(0)) {
            if (msg.value > 0) {
                emit Received(msg.sender, msg.value, msg.data);
            }
            return;
        }
        require(isAddressInSet(MODULE, module), "MODULE_UNAUTHORIZED");

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