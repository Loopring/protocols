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

import "../lib/MerkleTree.sol";


/// @title An Implementation of IExchange.
/// @author Brecht Devos - <brecht@loopring.org>,
contract Exchange is IExchange, NoDefaultFunc {
    using MathUint          for uint;
    using BytesUtil         for bytes;
    using ERC20SafeTransfer for address;
    using MerkleTree        for MerkleTree.Data;

    uint public MAX_NUM_DEPOSITS_IN_BLOCK       = 32;

    // Burn rates
    uint16 public constant BURNRATE_TIER1            =                       25; // 2.5%
    uint16 public constant BURNRATE_TIER2            =                  15 * 10; //  15%
    uint16 public constant BURNRATE_TIER3            =                  30 * 10; //  30%
    uint16 public constant BURNRATE_TIER4            =                  50 * 10; //  50%

    address public  tradeDelegateAddress        = address(0x0);

    event TokenRegistered(address tokenAddress, uint16 tokenID);
    event NewBurnRateBlock(uint blockIdx, bytes32 merkleRoot);

    event Deposit(uint24 account, uint16 dexID, address owner, address tokenAddress, uint amount);
    event Withdraw(uint24 account, uint16 dexID, address owner, address tokenAddress, uint amount);

    event BlockCommitted(uint blockIdx, bytes32 publicDataHash);
    event BlockFinalized(uint blockIdx);

    enum BlockType {
        TRADE,
        DEPOSIT,
        WITHDRAW
    }

    enum BlockState {
        COMMITTED,
        VERIFIED,
        FINALIZED
    }

    struct Token {
        address tokenAddress;
        uint8 tier;
        uint32 tierValidUntil;
    }

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

    struct Block {
        bytes32 accountsMerkleRoot;
        bytes32 tradeHistoryMerkleRoot;

        bytes32 publicDataHash;

        BlockState state;

        bytes withdrawals;
    }

    struct BurnRateBlock {
        bytes32 merkleRoot;
        uint32 validUntil;
    }

    MerkleTree.Data burnRateMerkleTree;

    Token[] public tokens;
    mapping (address => uint16) public tokenToTokenID;

    Account[] public accounts;

    Block[] public blocks;

    BurnRateBlock[] public burnRateBlocks;

    mapping (uint => DepositBlock) public depositBlocks;

    uint256[14] vk;
    uint256[] gammaABC;

    constructor(
        address _tradeDelegateAddress
        )
        public
    {
        require(_tradeDelegateAddress != address(0x0), ZERO_ADDRESS);
        tradeDelegateAddress = _tradeDelegateAddress;

        Block memory genesisBlock = Block(
            0x05DB23ABCB8B9FE614D065E0ABE095569A8CD6ACFE62FCA1646CE8A32A08CF1D,
            0x0A0697EA76AB4C7037053B18C79C928EA7540BC33BC48432FF472C8295A01BBA,
            0x0,
            BlockState.FINALIZED,
            new bytes(0)
        );
        blocks.push(genesisBlock);

        BurnRateBlock memory noTokensBlock = BurnRateBlock(
            0x0,
            0xFFFFFFFF
        );
        burnRateBlocks.push(noTokensBlock);
    }

    function commitBlock(
        uint blockType,
        uint burnRateBlockIdx,
        bytes memory data
        )
        public
    {
        Block storage currentBlock = blocks[blocks.length - 1];

        // TODO: don't send before merkle tree roots to save on calldata

        bytes32 accountsMerkleRootBefore;
        bytes32 accountsMerkleRootAfter;
        assembly {
            accountsMerkleRootBefore := mload(add(data, 32))
            accountsMerkleRootAfter := mload(add(data, 64))
        }
        require(accountsMerkleRootBefore == currentBlock.accountsMerkleRoot, "INVALID_ACCOUNTS_ROOT");

        bytes32 tradeHistoryMerkleRootBefore;
        bytes32 tradeHistoryMerkleRootAfter;
        if (blockType == uint(BlockType.TRADE)) {
            BurnRateBlock storage burnRateBlock = burnRateBlocks[burnRateBlockIdx];
            bytes32 burnRateMerkleRoot;
            uint32 inputTimestamp;
            assembly {
                tradeHistoryMerkleRootBefore := mload(add(data, 96))
                tradeHistoryMerkleRootAfter := mload(add(data, 128))
                burnRateMerkleRoot := mload(add(data, 160))
                inputTimestamp := and(mload(add(data, 164)), 0xFFFFFFFF)
            }
            require(burnRateMerkleRoot == burnRateBlock.merkleRoot, "INVALID_BURNRATE_ROOT");
            require(inputTimestamp > now - 60 && inputTimestamp < now + 60, "INVALID_TIMESTAMP");
        } else {
            tradeHistoryMerkleRootBefore = currentBlock.tradeHistoryMerkleRoot;
            tradeHistoryMerkleRootAfter = tradeHistoryMerkleRootBefore;
        }

        bytes32 publicDataHash = sha256(data);

        // Create a new block with the updated merkle roots
        Block memory newBlock = Block(
            accountsMerkleRootAfter,
            tradeHistoryMerkleRootAfter,
            publicDataHash,
            BlockState.COMMITTED,
            data
        );
        blocks.push(newBlock);

        emit BlockCommitted(blocks.length - 1, publicDataHash);
    }

    function verifyBlock(
        uint blockIdx,
        uint256[8] memory proof
        )
        public
    {
        require(blockIdx < blocks.length, INVALID_VALUE);
        Block storage specifiedBlock = blocks[blockIdx];
        require(specifiedBlock.state == BlockState.COMMITTED, "BLOCK_ALREADY_VERIFIED");

        bool verified = verifyProof(specifiedBlock.publicDataHash, proof);
        require(verified, "INVALID_PROOF");

        // Update state of this block and potentially the following blocks
        Block storage previousBlock = blocks[blockIdx - 1];
        if (previousBlock.state == BlockState.FINALIZED) {
            specifiedBlock.state = BlockState.FINALIZED;
            emit BlockFinalized(blockIdx);
            // The next blocks could become finalized as well so check this now
            // The number of blocks after the specified block index is limited
            // so we don't have to worry about running out of gas in this loop
            uint nextBlockIdx = blockIdx + 1;
            while (nextBlockIdx < blocks.length && blocks[nextBlockIdx].state == BlockState.VERIFIED) {
                blocks[nextBlockIdx].state = BlockState.FINALIZED;
                emit BlockFinalized(nextBlockIdx);
                nextBlockIdx++;
            }
        } else {
            specifiedBlock.state = BlockState.VERIFIED;
        }
    }

    function notifyBlockVerificationTooLate(
        uint blockIdx
        )
        external
    {
        require(blockIdx < blocks.length, INVALID_VALUE);
        Block storage specifiedBlock = blocks[blockIdx];
        require(specifiedBlock.state == BlockState.COMMITTED, INVALID_VALUE);
        // TODO: At a time limit in some way (number of blocks, timestamp, ...)
        revertState(blockIdx);
    }

    function revertState(
        uint blockIdx
        )
        internal
    {
        // TODO: Burn deposit of operator for LRC

        // Remove all blocks after and including blockIdx;
        blocks.length = blockIdx;
    }

    function registerToken(
        address tokenAddress
        )
        external
    {
        require(tokenToTokenID[tokenAddress] == 0, "ALREADY_REGISTERED");

        Token memory token = Token(
            tokenAddress,
            4,
            0
        );
        tokens.push(token);
        uint16 tokenID = uint16(tokens.length);
        tokenToTokenID[tokenAddress] = tokenID;
        emit TokenRegistered(tokenAddress, tokenID - 1);

        uint16 burnRate = getBurnRate(tokenID - 1);
        (, uint offset) = burnRateMerkleTree.Insert(burnRate);
        assert(offset == tokenID - 1);
        createNewBurnRateBlock();
    }

    function getTokenTier(
        uint24 tokenID
        )
        public
        view
        returns (uint8 tier)
    {
        Token storage token = tokens[tokenID];
        // Fall back to lowest tier
        tier = (now > token.tierValidUntil) ? 4 : token.tier;
    }

    function getBurnRate(
        uint24 tokenID
        )
        public
        view
        returns (uint16 burnRate)
    {
        uint tier = getTokenTier(tokenID);
        if (tier == 1) {
            burnRate = BURNRATE_TIER1;
        } else if (tier == 2) {
            burnRate = BURNRATE_TIER2;
        } else if (tier == 3) {
            burnRate = BURNRATE_TIER3;
        } else {
            burnRate = BURNRATE_TIER4;
        }
    }

    function updateBurnRate(
        uint24 tokenID
        )
        external
    {
        require(tokenID < tokens.length, "INVALID_TOKENID");

        uint16 burnRate = getBurnRate(tokenID);
        // TODO: MAKE THIS WORK
        burnRateMerkleTree.Update(tokenID, burnRate);

        // Create a new block if necessary
        createNewBurnRateBlock();
    }

    function createNewBurnRateBlock()
        internal
    {
        bytes32 newRoot = bytes32(burnRateMerkleTree.GetRoot());
        BurnRateBlock storage currentBlock = burnRateBlocks[burnRateBlocks.length - 1];
        if (newRoot == currentBlock.merkleRoot) {
            // No need for a new block
            return;
        }

        // Allow the use of older blocks for 1 hour
        currentBlock.validUntil = uint32(now + 3600);

        // Create the new block
        BurnRateBlock memory newBlock = BurnRateBlock(
            bytes32(newRoot),
            0xFFFFFFFF              // The last block is valid forever (until a new block is added)
        );
        burnRateBlocks.push(newBlock);

        emit NewBurnRateBlock(burnRateBlocks.length - 1, bytes32(newRoot));
    }

    function getTokenID(
        address tokenAddress
        )
        public
        view
        returns (uint16)
    {
        require(tokenToTokenID[tokenAddress] != 0, "TOKEN_NOT_REGISTERED");
        return tokenToTokenID[tokenAddress] - 1;
    }

    function deposit(
        address owner,
        uint brokerPublicKeyX,
        uint brokerPublicKeyY,
        uint16 dexID,
        address token,
        uint amount
        )
        public
        returns (uint24)
    {
        require(msg.sender == owner, "UNAUTHORIZED");
        uint16 tokenID = getTokenID(token);

        uint currentBlock = block.number / 40;
        DepositBlock storage depositBlock = depositBlocks[currentBlock];
        require(depositBlock.numDeposits < MAX_NUM_DEPOSITS_IN_BLOCK, "DEPOSIT_BLOCK_FULL");
        if (depositBlock.numDeposits == 0) {
            depositBlock.hash = bytes32(accounts.length);
        }

        if (amount > 0) {
            // Transfer the tokens from the owner into this contract
            require(
                token.safeTransferFrom(
                    owner,
                    address(this),
                    amount
                ),
                "UNSUFFICIENT_FUNDS"
            );
        }

        depositBlock.hash = sha256(
            abi.encodePacked(
                depositBlock.hash,
                brokerPublicKeyX,
                brokerPublicKeyY,
                dexID,
                tokenID,
                amount
            )
        );
        depositBlock.numDeposits++;

        Account memory account = Account(
            owner,
            dexID,
            token
        );
        uint24 accountID = uint24(accounts.length);
        accounts.push(account);

        emit Deposit(accountID, dexID, owner, token, amount);

        return accountID;
    }

    function withdraw(
        uint16 dexID,
        uint blockIdx,
        uint withdrawalIdx
        )
        external
    {
        Block storage withdrawBlock = blocks[blockIdx];
        require(withdrawBlock.state == BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

        // TODO: optimize
        bytes memory withdrawals = withdrawBlock.withdrawals;
        uint offset = 32 + 32 + (3 + 12) * (withdrawalIdx + 1);
        uint data;
        assembly {
            data := mload(add(withdrawals, offset))
        }
        uint24 accountID = uint24((data / 0x1000000000000000000000000) & 0xFFFFFF);
        uint amount = data & 0xFFFFFFFFFFFFFFFFFFFFFFFF;

        if (amount > 0) {
            Account storage account = accounts[accountID];
            // Transfer the tokens from the contract to the owner
            require(
                account.token.safeTransfer(
                    account.owner,
                    amount
                ),
                TRANSFER_FAILURE
            );

            // Set the amount to 0 so it cannot be withdrawn anymore
            data = data & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF000000000000000000000000;
            assembly {
                mstore(add(withdrawals, offset), data)
            }
            withdrawBlock.withdrawals = withdrawals;

            emit Withdraw(accountID, dexID, account.owner, account.token, amount);
        }
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

    function getBlockIdx()
        external
        view
        returns (uint)
    {
        return blocks.length - 1;
    }

    function getBurnRateRoot()
        external
        view
        returns (bytes32)
    {
        return bytes32(burnRateMerkleTree.GetRoot());
    }

    function getBurnRateBlockIdx()
        external
        view
        returns (uint)
    {
        return burnRateBlocks.length - 1;
    }
}
