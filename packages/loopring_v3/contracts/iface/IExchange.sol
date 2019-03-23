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
    event RealmCreated(
        uint32 realmID,
        address owner
    );

    event WalletRegistered(
        address walletOwner,
        uint24 walletID
    );

    event Deposit(
        uint32 realmID,
        uint32 depositBlockIdx,
        uint16 slotIdx,
        uint24 accountID,
        uint16 tokenID,
        uint24 walletID,
        uint96 amount
    );

    event Withdraw(
        uint32 realmID,
        uint24 accountID,
        uint16 tokenID,
        address to,
        uint96 amount
    );

    event WithdrawRequest(
        uint32 realmID,
        uint32 withdrawBlockIdx,
        uint16 slotIdx,
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
    );

    event BlockCommitted(
        uint32 realmID,
        uint blockIdx,
        bytes32 publicDataHash
    );

    event BlockFinalized(
        uint32 realmID,
        uint blockIdx
    );

    event Revert(
        uint32 realmID,
        uint blockIdx
    );

    event BlockFeeWithdraw(
        uint32 realmID,
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

    function getDepositFee(
        uint32 realmID
        )
        external
        view
        returns (uint);

    function getWithdrawFee(
        uint32 realmID
        )
        external
        view
        returns (uint);

    function setRealmFees(
        uint32 realmID,
        uint depositFee,
        uint withdrawFee
        )
        external;

    function commitBlock(
        uint blockType,
        bytes memory data
        )
        public;

    function verifyBlock(
        uint32 realmID,
        uint blockIdx,
        uint256[8] calldata proof
        )
        external;

    function revertBlock(
        uint32 realmID,
        uint32 blockIdx
        )
        external;

    function createAccount(
        uint32 realmID,
        uint publicKeyX,
        uint publicKeyY,
        uint24 walletID,
        uint16 tokenID,
        uint96 amount
        )
        public
        payable
        returns (uint24);

    function deposit(
        uint32 realmID,
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
        )
        external
        payable;

    function updateAccount(
        uint32 realmID,
        uint24 accountID,
        uint publicKeyX,
        uint publicKeyY,
        uint24 walletID,
        uint16 tokenID,
        uint96 amount
        )
        public
        payable;

    function requestWithdraw(
        uint32 realmID,
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
        )
        external
        payable;

    function withdraw(
        uint32 realmID,
        uint blockIdx,
        uint slotIdx
        )
        external;

    function withdrawBlockFee(
        uint32 realmID,
        uint32 blockIdx
        )
        external
        returns (bool);

    function getBlockIdx(
        uint32 realmID
        )
        external
        view
        returns (uint);

    function getNumAvailableDepositSlots(
        uint32 realmID
        )
        external
        view
        returns (uint);

    function getNumAvailableWithdrawSlots(
        uint32 realmID
        )
        external
        view
        returns (uint);

    function isInWithdrawMode(
        uint32 realmID
        )
        public
        view
        returns (bool);

    function withdrawFromMerkleTree(
        uint32 realmID,
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
        uint32 realmID,
        uint depositBlockIdx,
        uint slotIdx
        )
        external
        returns (bool);
}
