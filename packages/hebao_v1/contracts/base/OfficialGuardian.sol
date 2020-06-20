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
pragma solidity ^0.6.6;

import "../thirdparty/ERC1271.sol";
import "../lib/Claimable.sol";

/// @title OfficialGuardian
/// @author Freeman Zhong - <kongliang@loopring.org>
contract OfficialGuardian
{
    address public operator;
    address public erc1271Module;

    address public _owner;
    address public pendingOwner;

    event OperatorChanged(
        address indexed oldOperator,
        address indexed newOperator
    );

    event ERC1271ModuleChanged(
        address indexed oldERC1271Module,
        address indexed newERC1271Module
    );

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );


    modifier onlyOwner()
    {
        require(msg.sender == _owner, "UNAUTHORIZED");
        _;
    }

    modifier onlyPendingOwner() {
        require(msg.sender == pendingOwner, "UNAUTHORIZED");
        _;
    }

    constructor(
        address _operator,
        address _erc1271Module
    )
        public
    {
        require(_operator != address(0), "ZERO_ADDRESS");
        require(_erc1271Module != address(0), "ZERO_ADDRESS");

        _owner = msg.sender;
        operator = _operator;
        erc1271Module = _erc1271Module;
    }

    /// @dev Allows the current owner to set the pendingOwner address.
    /// @param newOwner The address to transfer ownership to.
    function transferOwnership(
        address newOwner
        )
        public
        onlyOwner
    {
        require(newOwner != address(0) && newOwner != _owner, "INVALID_ADDRESS");
        pendingOwner = newOwner;
    }

    /// @dev Allows the pendingOwner address to finalize the transfer.
    function claimOwnership()
        public
        onlyPendingOwner
    {
        emit OwnershipTransferred(_owner, pendingOwner);
        _owner = pendingOwner;
        pendingOwner = address(0);
    }

    function changeOperator(address newOperator)
        onlyOwner
        external
    {
        require(newOperator != address(0) && newOperator != operator,
                "INVALID_ADDRESS");

        emit OperatorChanged(operator, newOperator);
        operator = newOperator;
    }

    function changeERC1271Module(address newERC1271Module)
        onlyOwner
        external
    {
        require(newERC1271Module != address(0) &&
                newERC1271Module != erc1271Module, "INVALID_ADDRESS");

        emit ERC1271ModuleChanged(erc1271Module, newERC1271Module);
        erc1271Module = newERC1271Module;
    }

    function owner()
        public
        view
        returns(address)
    {
        return operator;
    }

    function isValidSignature(
        bytes memory _data,
        bytes memory _signature)
        public
        view
        returns (bytes4 magicValue)
    {
        return ERC1271(erc1271Module).isValidSignature(_data, _signature);
    }

}
