

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


contract BaseWallet is Wallet
{
    event Received(
        address indexed sender,
        uint    value,
        bytes   data
    );

    modifier onlyOwner
    {
        require(msg.sender == owner, "NOT_CALLED_BY_OWNER");
        _;
    }

    modifier onlyModule
    {
        require(moduleIdx[msg.sender] != 0, "NOT_CALLED_BY_MODULE");
        _;
    }

    function initialize(
        address            _owner,
        address[] calldata _modules
        )
        external
    {
        // TODO
    }

    function addModule(address _module)
        external
        onlyModule
    {
        // TODO
    }

    function delModule(address _module)
        external
        onlyModule
    {
        // TODO
    }

    function addFunction(bytes4 method, address module)
        external
        onlyModule
    {
        // TODO
    }

    function delFunction(bytes4 method)
        external
        onlyModule
    {
        // TODO
    }

    function transact(
        address          to,
        uint             value,
        bytes   calldata data
        )
        external
        onlyModule
        returns (bytes memory result)
    {
        bool success;
        // solium-disable-next-line security/no-call-value
        (success, result) = to.call.value(value)(data);
        if(!success) {
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
        address module = msg.data.length == 0 ? address(0) : functions[msg.sig];
        if(module == address(0)) {
            if (msg.value > 0) {
                emit Received(msg.sender, msg.value, msg.data);
            }
            return;
        }

        require(moduleIdx[module] !=0, "MODULE_UNAUTHORIZED");
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := staticcall(gas, module, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 {revert(0, returndatasize())}
            default {return (0, returndatasize())}
        }
    }
}