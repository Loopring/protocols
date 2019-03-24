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
    event Deposit(
        uint32 depositBlockIdx,
        uint16 slotIdx,
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
    );

    event Withdraw(
        uint24 accountID,
        uint16 tokenID,
        address to,
        uint96 amount
    );

    event WithdrawRequest(
        uint32 withdrawBlockIdx,
        uint16 slotIdx,
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
    );

    event BlockCommitted(
        uint blockIdx,
        bytes32 publicDataHash
    );

    event BlockFinalized(
        uint blockIdx
    );

    event Revert(
        uint blockIdx
    );

    event BlockFeeWithdraw(
        uint32 blockIdx,
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

    function setFees(
        uint depositFee,
        uint withdrawFee
        )
        external;

    function getDepositFee()
        external
        view
        returns (uint);

    function getWithdrawFee()
        external
        view
        returns (uint);

    function commitBlock(
        uint blockType,
        bytes memory data
        )
        public;

    function verifyBlock(
        uint blockIdx,
        uint256[8] calldata proof
        )
        external;

    function revertBlock(
        uint32 blockIdx
        )
        external;

    function createAccount(
        uint publicKeyX,
        uint publicKeyY,
        uint16 tokenID,
        uint96 amount
        )
        public
        payable
        returns (uint24);

    function deposit(
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
        )
        external
        payable;

    function updateAccount(
        uint24 accountID,
        uint publicKeyX,
        uint publicKeyY,
        uint16 tokenID,
        uint96 amount
        )
        public
        payable;

    function requestWithdraw(
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
        )
        external
        payable;

    function withdraw(
        uint blockIdx,
        uint slotIdx
        )
        external;

    function withdrawBlockFee(
        uint32 blockIdx
        )
        external
        returns (bool);

    function getBlockIdx()
        external
        view
        returns (uint);

    function getNumAvailableDepositSlots()
        external
        view
        returns (uint);

    function getNumAvailableWithdrawSlots()
        external
        view
        returns (uint);

    function isInWithdrawMode()
        public
        view
        returns (bool);

    function withdrawFromMerkleTree(
        uint24 accountID,
        uint16 tokenID,
        uint256[24] calldata accountPath,
        uint256[12] calldata balancePath,
        uint32 nonce,
        uint96 balance,
        uint256 tradeHistoryRoot
        )
        external
        returns (bool);

    function withdrawFromPendingDeposit(
        uint depositBlockIdx,
        uint slotIdx
        )
        external
        returns (bool);
}
