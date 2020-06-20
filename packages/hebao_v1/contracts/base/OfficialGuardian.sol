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

    address internal _owner;

    event OperatorChanged(address _operator);
    event ERC1271ModuleChanged(address _erc1271Module);

    modifier onlyOwner()
    {
        require(msg.sender == _owner, "UNAUTHORIZED");
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

    function changeOperator(address _operator)
        onlyOwner
        external
    {
        require(_operator != address(0), "ZERO_ADDRESS");
        require(operator != _operator, "ALREADY_OPERATOR");

        operator = _operator;
        emit OperatorChanged(_operator);
    }

    function changeERC1271Module(address _erc1271Module)
        onlyOwner
        external
    {
        require(_erc1271Module != address(0), "ZERO_ADDRESS");
        require(erc1271Module != _erc1271Module, "SAME_ADDRESS");

        erc1271Module = _erc1271Module;
        emit ERC1271ModuleChanged(_erc1271Module);
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
