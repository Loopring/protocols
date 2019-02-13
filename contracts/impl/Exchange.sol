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

import "../lib/BurnableERC20.sol";
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

    uint32 public constant MAX_PROOF_GENERATION_TIME_IN_SECONDS                 = 1 hours;

    uint public constant MIN_STAKE_AMOUNT_IN_LRC                                = 100000 ether;

    uint32 public constant MAX_INACTIVE_UNTIL_DISABLED_IN_SECONDS               = 1 days;

    uint32 public constant MIN_TIME_OPEN_DEPOSIT_BLOCK                          = 5 minutes;
    uint32 public constant MAX_TIME_OPEN_DEPOSIT_BLOCK                          = 1 hours;
    uint32 public constant MIN_TIME_CLOSED_DEPOSIT_BLOCK_UNTIL_COMMITTABLE      = 5 minutes;
    //uint32 public constant MAX_TIME_CLOSED_DEPOSIT_BLOCK_UNTIL_FORCED           = 15 minutes;
    uint32 public constant MAX_TIME_CLOSED_DEPOSIT_BLOCK_UNTIL_FORCED           = 1 days;     // TESTING

    uint16 public constant NUM_DEPOSITS_IN_BLOCK                 = 8;
    uint16 public constant NUM_WITHDRAWALS_IN_BLOCK              = 8;

    //uint32 public constant TIMESTAMP_WINDOW_SIZE_IN_SECONDS      = 1 minutes;
    uint32 public constant TIMESTAMP_WINDOW_SIZE_IN_SECONDS      = 1 days;        // TESTING

    uint public constant DEPOSIT_FEE_IN_ETH                      = 0.001 ether;

    uint public constant TOKEN_REGISTRATION_FEE_IN_LRC           = 100000 ether;
    uint public constant WALLET_REGISTRATION_FEE_IN_LRC          = 100000 ether;
    uint public constant RINGMATCHER_REGISTRATION_FEE_IN_LRC     = 100000 ether;

    uint public constant NEW_STATE_CREATION_FEE_IN_LRC           = 100000 ether;

    uint public constant MAX_NUM_TOKENS                          = 1024;
    uint public constant MAX_NUM_WALLETS                         = 1024;
    uint public constant MAX_NUM_RINGMATCHERS                    = 1024;

    uint public constant ACCOUNTS_START_INDEX                    = MAX_NUM_TOKENS;

    // Burn rates
    uint16 public constant BURNRATE_TIER1            =                       25; // 2.5%
    uint16 public constant BURNRATE_TIER2            =                  15 * 10; //  15%
    uint16 public constant BURNRATE_TIER3            =                  30 * 10; //  30%
    uint16 public constant BURNRATE_TIER4            =                  50 * 10; //  50%

    // Default account
    uint public constant DEFAULT_ACCOUNT_PUBLICKEY_X =  2760979366321990647384327991146539505488430080750363450053902718557853404165;
    uint public constant DEFAULT_ACCOUNT_PUBLICKEY_Y = 10771439851340068599303586501499035409517957710739943668636844002715618931667;
    uint public constant DEFAULT_ACCOUNT_SECRETKEY   =   531595266505639429282323989096889429445309320547115026296307576144623272935;


    address public lrcAddress        = address(0x0);

    event NewState(uint16 stateID, address owner);

    event TokenRegistered(address tokenAddress, uint16 tokenID);
    event WalletRegistered(address walletOwner, uint16 walletID);
    event RingMatcherRegistered(address ringMatcherOwner, uint16 ringMatcherID);

    event NewBurnRateBlock(uint blockIdx, bytes32 merkleRoot);

    event Deposit(uint32 depositBlockIdx, uint24 account, uint16 walletID, address owner, address tokenAddress, uint amount);
    event Withdraw(uint24 account, uint16 walletID, address owner, address tokenAddress, uint amount);

    event BlockCommitted(uint blockIdx, bytes32 publicDataHash);
    event BlockFinalized(uint blockIdx);

    event LogDepositBytes(bytes data);

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

    struct Wallet {
        address owner;
    }

    struct RingMatcher {
        address owner;
    }

    struct Operator {
        address payable owner;
    }

    struct Token {
        address tokenAddress;
        uint8 tier;
        uint32 tierValidUntil;
    }

    struct Account {
        address owner;
        uint16 walletID;
        uint16 tokenID;
    }

    struct PendingDeposit {
        uint24 accountID;
        uint96 amount;
    }

    struct DepositBlock {
        bytes32 hash;
        PendingDeposit[] pendingDeposits;

        uint16 numDeposits;
        uint32 timestampOpened;
        uint32 timestampFilled;
    }

    struct WithdrawBlock {
        uint numWithdrawals;
        bytes32 hash;
    }

    struct Block {
        bytes32 accountsMerkleRoot;
        bytes32 tradeHistoryMerkleRoot;

        bytes32 publicDataHash;

        BlockState state;

        uint16 operatorID;
        uint32 numDepositBlocksCommitted;
        bytes withdrawals;
    }

    struct BurnRateBlock {
        bytes32 merkleRoot;
        uint32 validUntil;
    }

    struct State {
        address owner;

        uint numAccounts;
        mapping (uint => Account) accounts;

        uint numBlocks;
        mapping (uint => Block) blocks;

        uint numDepositBlocks;
        mapping (uint => DepositBlock) depositBlocks;
        mapping (uint => WithdrawBlock) withdrawBlocks;

        uint numOperators;
        mapping (uint => Operator) operators;
    }

    MerkleTree.Data burnRateMerkleTree;

    Wallet[] public wallets;
    RingMatcher[] public ringMatchers;

    Token[] public tokens;
    mapping (address => uint16) public tokenToTokenID;

    BurnRateBlock[] public burnRateBlocks;

    State[] private states;

    uint256[14] vk;
    uint256[] gammaABC;

    constructor(
        address _lrcAddress
        )
        public
    {
        require(_lrcAddress != address(0x0), ZERO_ADDRESS);
        lrcAddress = _lrcAddress;

        BurnRateBlock memory noTokensBlock = BurnRateBlock(
            0x0,
            0xFFFFFFFF
        );
        burnRateBlocks.push(noTokensBlock);

        // Register ETH
        // registerTokenInternal(address(0x0));

        // Create the default state
        createNewStateInternal(address(0x0));
    }

    function createNewState()
        external
    {
        // Pay the fee
        burn(msg.sender, NEW_STATE_CREATION_FEE_IN_LRC);

        // Create the new state
        createNewStateInternal(msg.sender);
    }

    function createNewStateInternal(address owner)
        internal
    {
        State memory memoryState = State(
            owner,
            ACCOUNTS_START_INDEX,
            0,
            1,
            0
        );
        states.push(memoryState);

        Block memory genesisBlock = Block(
            0x05DB23ABCB8B9FE614D065E0ABE095569A8CD6ACFE62FCA1646CE8A32A08CF1D,
            0x0A0697EA76AB4C7037053B18C79C928EA7540BC33BC48432FF472C8295A01BBA,
            0x0,
            BlockState.FINALIZED,
            0xFFFF,
            0,
            new bytes(0)
        );
        State storage state = states[states.length - 1];
        state.blocks[state.numBlocks] = genesisBlock;
        state.numBlocks++;

        emit NewState(uint16(states.length - 1), owner);

        /*depositInternal(
            uint24(0xFFFFFF),
            address(this),
            DEFAULT_ACCOUNT_PUBLICKEY_X,
            DEFAULT_ACCOUNT_PUBLICKEY_Y,
            uint16(0),
            address(0x0),
            uint96(0)
        );*/
    }

    event LogTimeStamp(uint32 data);

    function commitBlock(
        uint blockType,
        uint burnRateBlockIdx,
        bytes memory data
        )
        public
    {
        uint16 stateID = 0;
        assembly {
            stateID := and(mload(add(data, 2)), 0xFFFF)
        }

        require(stateID < states.length, "INVALID_STATEID");
        State storage state = states[stateID];

        Block storage currentBlock = state.blocks[state.numBlocks - 1];

        // TODO: don't send before merkle tree roots to save on calldata

        bytes32 accountsMerkleRootBefore;
        bytes32 accountsMerkleRootAfter;
        assembly {
            accountsMerkleRootBefore := mload(add(data, 34))
            accountsMerkleRootAfter := mload(add(data, 66))
        }
        require(accountsMerkleRootBefore == currentBlock.accountsMerkleRoot, "INVALID_ACCOUNTS_ROOT");

        uint32 numDepositBlocksCommitted = currentBlock.numDepositBlocksCommitted;
        bytes32 tradeHistoryMerkleRootBefore;
        bytes32 tradeHistoryMerkleRootAfter;
        if (blockType == uint(BlockType.TRADE)) {
            BurnRateBlock storage burnRateBlock = burnRateBlocks[burnRateBlockIdx];
            bytes32 burnRateMerkleRoot;
            uint32 inputTimestamp;
            assembly {
                tradeHistoryMerkleRootBefore := mload(add(data, 98))
                tradeHistoryMerkleRootAfter := mload(add(data, 130))
                burnRateMerkleRoot := mload(add(data, 162))
                inputTimestamp := and(mload(add(data, 166)), 0xFFFFFFFF)
            }
            require(burnRateMerkleRoot == burnRateBlock.merkleRoot, "INVALID_BURNRATE_ROOT");
            require(inputTimestamp > now - TIMESTAMP_WINDOW_SIZE_IN_SECONDS &&
                    inputTimestamp < now + TIMESTAMP_WINDOW_SIZE_IN_SECONDS, "INVALID_TIMESTAMP");
        } else if (blockType == uint(BlockType.DEPOSIT)) {
            require(isDepositBlockCommittable(stateID, numDepositBlocksCommitted), "CANNOT_COMMIT_DEPOSIT_BLOCK_YET");
            DepositBlock storage depositBlock = state.depositBlocks[numDepositBlocksCommitted];
            // Pad the block so it's full
            for (uint i = depositBlock.numDeposits; i < NUM_DEPOSITS_IN_BLOCK; i++) {
                depositBlock.hash = sha256(
                    abi.encodePacked(
                        depositBlock.hash,
                        uint24(0),
                        DEFAULT_ACCOUNT_PUBLICKEY_X,
                        DEFAULT_ACCOUNT_PUBLICKEY_Y,
                        uint16(0),
                        uint16(0),
                        uint96(0)
                    )
                );
            }
            bytes32 depositBlockHash = depositBlock.hash;
            assembly {
                mstore(add(data, 98), depositBlockHash)
            }
            numDepositBlocksCommitted++;
            emit LogDepositBytes(data);

            tradeHistoryMerkleRootBefore = currentBlock.tradeHistoryMerkleRoot;
            tradeHistoryMerkleRootAfter = tradeHistoryMerkleRootBefore;
        }
        else {
            tradeHistoryMerkleRootBefore = currentBlock.tradeHistoryMerkleRoot;
            tradeHistoryMerkleRootAfter = tradeHistoryMerkleRootBefore;
        }

        // Check if we need to commit a deposit block
        require(!isDepositBlockForced(stateID, numDepositBlocksCommitted), "DEPOSIT_BLOCK_COMMIT_FORCED");

        bytes32 publicDataHash = sha256(data);

        uint16 operatorID = 0;

        // Create a new block with the updated merkle roots
        Block memory newBlock = Block(
            accountsMerkleRootAfter,
            tradeHistoryMerkleRootAfter,
            publicDataHash,
            BlockState.COMMITTED,
            operatorID,
            numDepositBlocksCommitted,
            data
        );
        state.blocks[state.numBlocks] = newBlock;
        state.numBlocks++;

        emit BlockCommitted(state.numBlocks - 1, publicDataHash);
    }

    function verifyBlock(
        uint16 stateID,
        uint blockIdx,
        uint256[8] memory proof
        )
        public
    {
        require(stateID < states.length, "INVALID_STATEID");
        State storage state = states[stateID];

        require(blockIdx < state.numBlocks, INVALID_VALUE);
        Block storage specifiedBlock = state.blocks[blockIdx];
        require(specifiedBlock.state == BlockState.COMMITTED, "BLOCK_ALREADY_VERIFIED");

        bool verified = verifyProof(specifiedBlock.publicDataHash, proof);
        require(verified, "INVALID_PROOF");

        // Update state of this block and potentially the following blocks
        Block storage previousBlock = states[0].blocks[blockIdx - 1];
        if (previousBlock.state == BlockState.FINALIZED) {
            specifiedBlock.state = BlockState.FINALIZED;
            emit BlockFinalized(blockIdx);
            // The next blocks could become finalized as well so check this now
            // The number of blocks after the specified block index is limited
            // so we don't have to worry about running out of gas in this loop
            uint nextBlockIdx = blockIdx + 1;
            while (nextBlockIdx < state.numBlocks && state.blocks[nextBlockIdx].state == BlockState.VERIFIED) {
                state.blocks[nextBlockIdx].state = BlockState.FINALIZED;
                emit BlockFinalized(nextBlockIdx);
                nextBlockIdx++;
            }
        } else {
            specifiedBlock.state = BlockState.VERIFIED;
        }
    }

    function notifyBlockVerificationTooLate(
        uint16 stateID,
        uint blockIdx
        )
        external
    {
        require(stateID < states.length, "INVALID_STATEID");
        State storage state = states[stateID];

        require(blockIdx < state.numBlocks, INVALID_VALUE);
        Block storage specifiedBlock = state.blocks[blockIdx];
        require(specifiedBlock.state == BlockState.COMMITTED, INVALID_VALUE);
        // TODO: At a time limit in some way (number of blocks, timestamp, ...)
        revertBlock(stateID, blockIdx);
    }

    function revertBlock(
        uint16 stateID,
        uint blockIdx
        )
        internal
    {
        require(stateID < states.length, "INVALID_STATEID");
        State storage state = states[stateID];
        // TODO: Burn deposit of operator for LRC

        // Remove all blocks after and including blockIdx;
        state.numBlocks = blockIdx;
    }

    function registerToken(
        address tokenAddress
        )
        external
    {
        require(tokenToTokenID[tokenAddress] == 0, "ALREADY_REGISTERED");

        // Pay the fee
        burn(msg.sender, TOKEN_REGISTRATION_FEE_IN_LRC);

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
        uint16 stateID,
        uint24 accountID,
        address owner,
        uint brokerPublicKeyX,
        uint brokerPublicKeyY,
        uint16 walletID,
        address token,
        uint96 amount
        )
        public
        payable
        returns (uint24)
    {
        require(stateID < states.length, "INVALID_STATEID");
        State storage state = states[stateID];
        // require(msg.sender == owner, UNAUTHORIZED);

        // Check expected ETH value sent
        if (token != address(0x0)) {
            require(msg.value == DEPOSIT_FEE_IN_ETH, "WRONG_ETH_VALUE");
        } else {
            require(msg.value == (DEPOSIT_FEE_IN_ETH + amount), "WRONG_ETH_VALUE");
        }

        uint16 tokenID = getTokenID(token);

        // Get the deposit block
        DepositBlock storage depositBlock = state.depositBlocks[state.numDepositBlocks - 1];
        if (isActiveDepositBlockClosed(stateID)) {
            state.numDepositBlocks++;
            depositBlock = state.depositBlocks[state.numDepositBlocks - 1];
        }
        if (depositBlock.numDeposits == 0) {
            depositBlock.timestampOpened = uint32(now);
        }
        require(depositBlock.numDeposits < NUM_DEPOSITS_IN_BLOCK, "DEPOSIT_BLOCK_FULL");

        if (amount > 0 && token != address(0x0)) {
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

        if (accountID == 0xFFFFFF) {
            Account memory account = Account(
                owner,
                walletID,
                tokenID
            );
            uint24 newAccountID = uint24(state.numAccounts);
            state.accounts[newAccountID] = account;
            state.numAccounts++;

            accountID = newAccountID;
        } else {
            Account storage account = state.accounts[accountID];
            require(account.owner == owner, "INVALID OWNER");
            require(account.tokenID == tokenID, "INVALID TOKEN");
        }

        /*bytes memory data = abi.encodePacked(
                depositBlock.hash,
                accountID,
                brokerPublicKeyX,
                brokerPublicKeyY,
                walletID,
                tokenID,
                amount
        );
        emit LogDepositBytes(data);*/

        depositBlock.hash = sha256(
            abi.encodePacked(
                depositBlock.hash,
                accountID,
                brokerPublicKeyX,
                brokerPublicKeyY,
                walletID,
                tokenID,
                amount
            )
        );
        depositBlock.numDeposits++;
        if (depositBlock.numDeposits == NUM_DEPOSITS_IN_BLOCK) {
            depositBlock.timestampFilled = uint32(now);
        }

        PendingDeposit memory pendingDeposit = PendingDeposit(
            accountID,
            amount
        );
        depositBlock.pendingDeposits.push(pendingDeposit);

        emit Deposit(uint32(state.numDepositBlocks - 1), accountID, walletID, owner, token, amount);

        return accountID;
    }

    function requestWithdraw(
        uint16 stateID,
        uint24 accountID,
        uint96 amount
        )
        external
    {
        require(amount > 0, INVALID_VALUE);

        require(stateID < states.length, "INVALID_STATEID");
        State storage state = states[stateID];

        // Don't check account owner for burn accounts
        if (accountID >= MAX_NUM_TOKENS) {
            Account storage account = state.accounts[accountID];
            require(account.owner == msg.sender, "UNAUTHORIZED");
        }

        uint currentBlock = block.number / 40;
        WithdrawBlock storage withdrawBlock = state.withdrawBlocks[currentBlock];
        require(withdrawBlock.numWithdrawals < NUM_WITHDRAWALS_IN_BLOCK, "WITHDRAWAL_BLOCK_FULL");
        if (withdrawBlock.numWithdrawals == 0) {
            withdrawBlock.hash = 0x0;
        }

        withdrawBlock.hash = sha256(
            abi.encodePacked(
                withdrawBlock.hash,
                accountID,
                amount
            )
        );
        withdrawBlock.numWithdrawals++;
    }

    function withdraw(
        uint16 stateID,
        uint blockIdx,
        uint withdrawalIdx
        )
        external
    {
        require(stateID < states.length, "INVALID_STATEID");
        State storage state = states[stateID];

        require(blockIdx < state.numBlocks, "INVALID_BLOCKIDX");
        Block storage withdrawBlock = state.blocks[blockIdx];
        require(withdrawBlock.state == BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

        // TODO: optimize
        bytes memory withdrawals = withdrawBlock.withdrawals;
        uint offset = 2 + 32 + 32 + (3 + 12) * (withdrawalIdx + 1);
        require(offset < withdrawals.length + 32, "INVALID_WITHDRAWALIDX");
        uint data;
        assembly {
            data := mload(add(withdrawals, offset))
        }
        uint24 accountID = uint24((data / 0x1000000000000000000000000) & 0xFFFFFF);
        uint amount = data & 0xFFFFFFFFFFFFFFFFFFFFFFFF;

        if (amount > 0) {
            // Burn information
            address payable owner = address(0x0);
            uint16 walletID = 0;
            uint16 tokenID = uint16(accountID);

            // Get the account information if this isn't a burn account
            if (accountID >= MAX_NUM_TOKENS)
            {
                assert(accountID < state.numAccounts);
                Account storage account = state.accounts[accountID];
                owner = address(uint160(account.owner));
                walletID = account.walletID;
                tokenID = account.tokenID;
            }

            // Transfer the tokens from the contract to the owner
            assert(tokenID < tokens.length);
            address token = tokens[tokenID].tokenAddress;
            if (token == address(0x0)) {
                // ETH
                owner.transfer(amount);
            } else {
                // ERC20 token
                require(
                    token.safeTransfer(
                        owner,
                        amount
                    ),
                    TRANSFER_FAILURE
                );
            }

            // Set the amount to 0 so it cannot be withdrawn anymore
            data = data & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF000000000000000000000000;
            assembly {
                mstore(add(withdrawals, offset), data)
            }
            withdrawBlock.withdrawals = withdrawals;

            emit Withdraw(accountID, walletID, owner, token, amount);
        }
    }

    function registerWallet()
        external
    {
        burn(msg.sender, WALLET_REGISTRATION_FEE_IN_LRC);

        Wallet memory wallet = Wallet(
            msg.sender
        );
        wallets.push(wallet);

        emit WalletRegistered(wallet.owner, uint16(wallets.length - 1));
    }

    function registerRingMatcher()
        external
    {
        burn(msg.sender, RINGMATCHER_REGISTRATION_FEE_IN_LRC);

        RingMatcher memory ringMatcher = RingMatcher(
            msg.sender
        );
        ringMatchers.push(ringMatcher);

        emit RingMatcherRegistered(ringMatcher.owner, uint16(ringMatchers.length - 1));
    }

    function registerOperator()
        external
    {

    }

    function withdrawFeeEarnedInBlock(
        uint16 stateID,
        uint32 blockIdx
        )
        external
    {
        require(stateID < states.length, "INVALID_STATEID");
        State storage state = states[stateID];

        require(blockIdx > 0, INVALID_VALUE);
        require(blockIdx < state.numBlocks, INVALID_VALUE);

        Block storage requestedBlock = state.blocks[blockIdx];
        Block storage previousBlock = state.blocks[blockIdx - 1];

        require(requestedBlock.numDepositBlocksCommitted > previousBlock.numDepositBlocksCommitted, "NO_FEE_AVAILABLE");
        require(requestedBlock.state == BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

        address payable operator = states[stateID].operators[requestedBlock.operatorID].owner;
        uint32 depositBlockIdx = previousBlock.numDepositBlocksCommitted;

        DepositBlock storage depositBlock = state.depositBlocks[depositBlockIdx];
        uint fee = depositBlock.numDeposits * DEPOSIT_FEE_IN_ETH;

        operator.transfer(fee);
    }

    function burn(
        address from,
        uint amount
        )
        internal
    {
        require(
            BurnableERC20(lrcAddress).burnFrom(
                from,
                amount
            ),
            BURN_FAILURE
        );
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

    function getBlockIdx(
        uint16 stateID
        )
        external
        view
        returns (uint)
    {
        return states[stateID].numBlocks - 1;
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

    function getDepositHash(
        uint16 stateID,
        uint depositBlockIdx
        )
        external
        view
        returns (bytes32)
    {
        return states[stateID].depositBlocks[depositBlockIdx].hash;
    }

    function isActiveDepositBlockClosed(
        uint16 stateID
        )
        internal
        view
        returns (bool)
    {
        // When to create a new deposit block:
        // - block is full: the old block needs to be at least MIN_TIME_OPEN_DEPOSIT_BLOCK seconds old
        //                  (so we don't saturate the operators with deposits)
        // - block is partially full: the old block is at least MAX_TIME_OPEN_DEPOSIT_BLOCK seconds old
        //                            (so we can guarantee a maximum amount of time to the users
        //                             when the deposits will be available)
        require(stateID < states.length, "INVALID_STATEID");
        State storage state = states[stateID];
        DepositBlock storage depositBlock = state.depositBlocks[state.numDepositBlocks - 1];
        if ((depositBlock.numDeposits == NUM_DEPOSITS_IN_BLOCK && now > depositBlock.timestampOpened + MIN_TIME_OPEN_DEPOSIT_BLOCK) ||
            (depositBlock.numDeposits > 0 && now > depositBlock.timestampOpened + MAX_TIME_OPEN_DEPOSIT_BLOCK)) {
            return true;
        } else {
            return false;
        }
    }

    function isDepositBlockCommittable(
        uint16 stateID,
        uint32 depositBlockIdx
        )
        internal
        view
        returns (bool)
    {
        require(stateID < states.length, "INVALID_STATEID");
        State storage state = states[stateID];
        require(depositBlockIdx < state.numDepositBlocks, "INVALID_DEPOSITBLOCK_IDX_COMMIT");
        DepositBlock storage depositBlock = state.depositBlocks[depositBlockIdx];
        if ((depositBlock.numDeposits == NUM_DEPOSITS_IN_BLOCK && now > depositBlock.timestampFilled + MIN_TIME_CLOSED_DEPOSIT_BLOCK_UNTIL_COMMITTABLE) ||
            (depositBlock.numDeposits > 0 && now > depositBlock.timestampOpened + MAX_TIME_OPEN_DEPOSIT_BLOCK + MIN_TIME_CLOSED_DEPOSIT_BLOCK_UNTIL_COMMITTABLE)) {
            return true;
        } else {
            return false;
        }
    }

    function isDepositBlockForced(
        uint16 stateID,
        uint32 depositBlockIdx
        )
        internal
        view
        returns (bool)
    {
        require(stateID < states.length, "INVALID_STATEID");
        State storage state = states[stateID];
        require(depositBlockIdx <= state.numDepositBlocks, "INVALID_DEPOSITBLOCK_IDX_FORCED");
        DepositBlock storage depositBlock = state.depositBlocks[depositBlockIdx];
        if ((depositBlock.numDeposits == NUM_DEPOSITS_IN_BLOCK && now > depositBlock.timestampFilled + MAX_TIME_CLOSED_DEPOSIT_BLOCK_UNTIL_FORCED) ||
            (depositBlock.numDeposits > 0 && now > depositBlock.timestampOpened + MAX_TIME_OPEN_DEPOSIT_BLOCK + MAX_TIME_CLOSED_DEPOSIT_BLOCK_UNTIL_FORCED)) {
            return true;
        } else {
            return false;
        }
    }

    function getNumAvailableDepositSlots(
        uint16 stateID
        )
        external
        view
        returns (uint)
    {
        require(stateID < states.length, "INVALID_STATEID");
        if (isActiveDepositBlockClosed(stateID)) {
            return NUM_DEPOSITS_IN_BLOCK;
        } else {
            State storage state = states[stateID];
            DepositBlock storage depositBlock = state.depositBlocks[state.numDepositBlocks - 1];
            return NUM_DEPOSITS_IN_BLOCK - depositBlock.numDeposits;
        }
    }
}
