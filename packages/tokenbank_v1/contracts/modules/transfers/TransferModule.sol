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

import "../security/SecurityModule.sol";


/// @title TransferModule
contract TransferModule is SecurityModule
{
    bytes4 internal constant ERC20_TRANSFER = bytes4(keccak256("transfer(address,uint256)"));
    bytes4 internal constant ERC20_APPROVE = bytes4(keccak256("approve(address,uint256)"));

    event Transfered(
        address indexed wallet,
        address indexed token,
        address indexed to,
        uint            amount,
        bytes           data
    );
    event Approved(
        address indexed wallet,
        address indexed token,
        address         to,
        uint            amount
    );
    event ContractCalled(
        address indexed wallet,
        address indexed to,
        uint            amount,
        bytes           data
    );

    function transferInternal(
        address wallet,
        address token,
        address to,
        uint    amount,
        bytes   memory data
        )
        internal
    {
        if (token == address(0)) {
            transact(wallet, to, amount, "");
        } else {
            bytes memory callData = abi.encodeWithSignature(
                "transfer(address,uint256)",
                to,
                amount
            );
            transact(wallet, token, 0, callData);
        }
        emit Transfered(wallet, token, to, amount, data);
    }

    function approveInternal(
        address wallet,
        address token,
        address to,
        uint    amount
        )
        internal
    {
        require(token != address(0), "UNSUPPORTED");

        bytes memory callData = abi.encodeWithSignature(
            "approve(address,uint256)",
            to,
            amount
        );
        transact(wallet, token, 0, callData);
        emit Approved(wallet, token, to, amount);
    }

    function callContractInternal(
        address wallet,
        address to,
        uint    amount,
        bytes   memory data
        )
        internal
    {
        bytes4 method = extractMethod(data);
        require(method != ERC20_TRANSFER && method != ERC20_APPROVE, "INVALID_METHOD");

        transact(wallet, to, amount, data);
        emit ContractCalled(wallet, to, amount, data);
    }
}
