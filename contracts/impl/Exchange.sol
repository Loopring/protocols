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

import "../iface/IExchange.sol";
import "../iface/ITradeDelegate.sol";

import "../lib/ERC20SafeTransfer.sol";
import "../lib/Verifier.sol";

import "../lib/BytesUtil.sol";
import "../lib/MathUint.sol";
import "../lib/NoDefaultFunc.sol";


/// @title An Implementation of IExchange.
/// @author Brecht Devos - <brecht@loopring.org>,
contract Exchange is IExchange, NoDefaultFunc {
    using MathUint      for uint;
    using BytesUtil     for bytes;

    uint public MAX_NUM_DEPOSITS_IN_BLOCK       = 32;

    address public  tradeDelegateAddress        = address(0x0);

    bytes32 public accountsMerkleRoot           = 0x282B2D2BEB6A5269A0162C8477825D3D9352526705DFA351483C72E68EAFE9A9;
    bytes32 public tradeHistoryMerkleRoot       = 0x056E110222A84609DE5696E61A9F18731AFD9C4743F77D85C6F7267CB1617571;

    uint256[14] vk;
    uint256[] gammaABC;

    event TokenRegistered(address tokenAddress, uint tokenID);

    struct Token {
        address tokenAddress;
    }
    Token[] public tokens;
    mapping (address => uint) public tokenToTokenID;

    struct Account {
        address owner;
        uint16 dexID;
        address token;
    }

    struct DepositBlock {
        uint numDeposits;
        bytes32 hash;
        bool done;
    }

    struct Withdrawal {
        uint32 accountID;
        uint96 amount;
    }

    struct Block {
        Withdrawal[] witdrawals;
    }

    Account[] public accounts;
    mapping (uint => DepositBlock) public depositBlocks;

    constructor(
        address _tradeDelegateAddress
        )
        public
    {
        require(_tradeDelegateAddress != address(0x0), ZERO_ADDRESS);

        tradeDelegateAddress = _tradeDelegateAddress;
    }

    function submitRings(
        bytes memory data,
        uint256[8] memory proof
        )
        public
    {
        // TODO: don't send tradeHistoryMerkleRootBefore to save on calldata
        bytes32 accountsMerkleRootBefore;
        bytes32 accountsMerkleRootAfter;
        bytes32 tradeHistoryMerkleRootBefore;
        bytes32 tradeHistoryMerkleRootAfter;
        assembly {
            accountsMerkleRootBefore := mload(add(data, 32))
            accountsMerkleRootAfter := mload(add(data, 64))
            tradeHistoryMerkleRootBefore := mload(add(data, 96))
            tradeHistoryMerkleRootAfter := mload(add(data, 128))
        }
        require(accountsMerkleRootBefore == accountsMerkleRoot, "INVALID_ACCOUNTS_ROOT");
        require(tradeHistoryMerkleRootBefore == tradeHistoryMerkleRoot, "INVALID_TRADEHISTORY_ROOT");

        bytes32 publicDataHash = sha256(data);
        bool verified = verifyProof(publicDataHash, proof);
        require(verified, "INVALID_PROOF");

        // Update the merkle roots
        accountsMerkleRoot = accountsMerkleRootAfter;
        tradeHistoryMerkleRoot = tradeHistoryMerkleRootAfter;
    }

    function submitDeposits(
        bytes memory data,
        uint256[8] memory proof
        )
        public
    {
        // TODO: don't send accountsMerkleRootBefore to save on calldata
        bytes32 accountsMerkleRootBefore;
        bytes32 accountsMerkleRootAfter;
        assembly {
            accountsMerkleRootBefore := mload(add(data, 32))
            accountsMerkleRootAfter := mload(add(data, 64))
        }
        require(accountsMerkleRootBefore == accountsMerkleRoot, "INVALID_ACCOUNTS_ROOT");

        bytes32 publicDataHash = sha256(data);
        bool verified = verifyProof(publicDataHash, proof);
        require(verified, "INVALID_PROOF");

        // Update the merkle root
        accountsMerkleRoot = accountsMerkleRootAfter;
    }

    function registerToken(
        address tokenAddress
        )
        external
    {
        require(tokenToTokenID[tokenAddress] == 0, "ALREADY_REGISTERED");
        Token memory token = Token(
            tokenAddress
        );
        tokens.push(token);

        tokenToTokenID[tokenAddress] = tokens.length;

        emit TokenRegistered(tokenAddress, tokens.length - 1);
    }

    function getTokenID(
        address tokenAddress
        )
        external
        view
        returns (uint)
    {
        require(tokenToTokenID[tokenAddress] != 0, "NOT_REGISTERED");
        return tokenToTokenID[tokenAddress] - 1;
    }

    function deposit(
        uint16 dexID,
        address owner,
        uint brokerPublicKeyX,
        uint brokerPublicKeyY,
        address token,
        uint amount
        )
        public
    {
        require(msg.sender == owner, "UNAUTHORIZED");
        uint currentBlock = block.number / 40;
        DepositBlock storage depositBlock = depositBlocks[currentBlock];
        require(depositBlock.numDeposits < MAX_NUM_DEPOSITS_IN_BLOCK, "DEPOSIT_BLOCK_FULL");
        if (depositBlock.numDeposits == 0) {
            depositBlock.hash = bytes32(accounts.length);
        }

        depositBlock.hash = sha256(
            abi.encodePacked(
                depositBlock.hash,
                brokerPublicKeyX,
                brokerPublicKeyY,
                owner,
                dexID,
                token,
                amount
            )
        );
        depositBlock.numDeposits++;

        Account memory account = Account(
            owner,
            dexID,
            token
        );
        accounts.push(account);
    }

    function withdraw(
        uint dexID,
        uint blockIdx,
        uint withdrawalIdx
        )
        public
    {
        // empty
    }

    function verifyProof(
        bytes32 _publicDataHash,
        uint256[8] memory proof
        )
        internal
        view
        returns (bool)
    {
        uint256[] memory publicInputs = new uint256[](1);
        publicInputs[0] = uint256(_publicDataHash);

        uint256[14] memory _vk;
        uint256[] memory _vk_gammaABC;
        (_vk, _vk_gammaABC) = getVerifyingKey();

        return Verifier.Verify(_vk, _vk_gammaABC, proof, publicInputs);
    }

    function getVerifyingKey()
        public
        view
        returns (uint256[14] memory out_vk, uint256[] memory out_gammaABC)
    {
        return (vk, gammaABC);
    }

    function setVerifyingKey(
        uint256[14] memory _vk,
        uint256[] memory _gammaABC
        )
        public
    {
        vk = _vk;
        gammaABC = _gammaABC;
    }
}
