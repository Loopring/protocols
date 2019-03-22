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
pragma solidity 0.5.2;


/// @title IExchange
/// @author Brecht Devos - <brecht@loopring.org>
contract IExchange
{
    event NewState(
        uint32 stateID,
        address owner
    );

    event OperatorRegistered(
        address operator,
        uint32 operatorID
    );

    event OperatorUnregistered(
        address operator,
        uint32 operatorID
    );

    event WalletRegistered(
        address walletOwner,
        uint24 walletID
    );

    event Deposit(
        uint32 stateID,
        uint32 depositBlockIdx,
        uint16 slotIdx,
        uint24 accountID,
        uint16 tokenID,
        uint24 walletID,
        uint96 amount
    );

    event Withdraw(
        uint32 stateID,
        uint24 accountID,
        uint16 tokenID,
        address to,
        uint96 amount
    );

    event WithdrawRequest(
        uint32 stateID,
        uint32 withdrawBlockIdx,
        uint16 slotIdx,
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
    );

    event BlockCommitted(
        uint32 stateID,
        uint blockIdx,
        bytes32 publicDataHash
    );

    event BlockFinalized(
        uint32 stateID,
        uint blockIdx
    );

    event Revert(
        uint32 stateID,
        uint blockIdx
    );

    event BlockFeeWithdraw(
        uint32 stateID,
        uint32 blockIdx,
        address operator,
        uint amount
    );

    event WithdrawBurned(
        address token,
        uint amount
    );

    mapping (address => uint) public burnBalances;

    function withdrawBurned(
        address token,
        uint amount
        )
        external
        returns (bool success);
}
