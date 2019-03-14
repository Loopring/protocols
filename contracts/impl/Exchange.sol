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
import "../iface/ITokenRegistry.sol";
import "../iface/IBlockVerifier.sol";

import "../lib/BurnableERC20.sol";
import "../lib/ERC20SafeTransfer.sol";

import "../lib/MathUint.sol";
import "../lib/MiMC.sol";
import "../lib/NoDefaultFunc.sol";


/// @title An Implementation of IExchange.
/// @author Brecht Devos - <brecht@loopring.org>,
contract Exchange is IExchange, NoDefaultFunc {
    using MathUint          for uint;
    using ERC20SafeTransfer for address;

    uint32 public constant MAX_PROOF_GENERATION_TIME_IN_SECONDS                 = 1 hours;

    uint public constant STAKE_AMOUNT_IN_LRC                                    = 100000 ether;
    uint32 public constant MIN_TIME_UNTIL_OPERATOR_CAN_WITHDRAWAL               = 1 days;

    uint32 public constant MAX_INACTIVE_UNTIL_DISABLED_IN_SECONDS               = 1 days;

    uint32 public constant MIN_TIME_BLOCK_OPEN                          = 1 minutes;
    uint32 public constant MAX_TIME_BLOCK_OPEN                          = 15 minutes;
    uint32 public constant MIN_TIME_BLOCK_CLOSED_UNTIL_COMMITTABLE      = 2 minutes;
    //uint32 public constant MAX_TIME_BLOCK_CLOSED_UNTIL_FORCED           = 15 minutes;
    uint32 public constant MAX_TIME_BLOCK_CLOSED_UNTIL_FORCED           = 1 days;     // TESTING

    uint32 public constant MAX_TIME_BLOCK_UNTIL_WITHDRAWALMODE          = 1 days;     // TESTING

    uint16 public constant NUM_DEPOSITS_IN_BLOCK                 = 8;
    uint16 public constant NUM_WITHDRAWALS_IN_BLOCK              = 8;

    //uint32 public constant TIMESTAMP_WINDOW_SIZE_IN_SECONDS      = 1 minutes;
    uint32 public constant TIMESTAMP_WINDOW_SIZE_IN_SECONDS      = 1 days;        // TESTING

    uint public constant MAX_NUM_WALLETS                         = 2 ** 23;

    // Default account
    uint public constant DEFAULT_ACCOUNT_PUBLICKEY_X =  2760979366321990647384327991146539505488430080750363450053902718557853404165;
    uint public constant DEFAULT_ACCOUNT_PUBLICKEY_Y = 10771439851340068599303586501499035409517957710739943668636844002715618931667;
    uint public constant DEFAULT_ACCOUNT_SECRETKEY   =   531595266505639429282323989096889429445309320547115026296307576144623272935;


    address public lrcAddress                = address(0x0);
    address public tokenRegistryAddress      = address(0x0);
    address public blockVerifierAddress      = address(0x0);

    event NewState(uint32 stateID, address owner);

    event OperatorRegistered(address operator, uint32 operatorID);
    event WalletRegistered(address walletOwner, uint24 walletID);

    event Deposit(uint32 stateID, uint32 depositBlockIdx, uint24 accountID, uint16 tokenID, uint24 walletID, uint96 amount);
    event Withdraw(uint32 stateID, uint24 accountID, uint16 tokenID, address to, uint96 amount);
    event WithdrawRequest(uint32 stateID, uint32 withdrawBlockIdx, uint24 accountID, uint16 tokenID, uint96 amount);

    event BlockCommitted(uint blockIdx, bytes32 publicDataHash);
    event BlockFinalized(uint blockIdx);

    event BlockFeeWithdraw(uint32 stateID, uint32 blockIdx, address operator, uint amount);

    event WithdrawBurned(address token, uint amount);

    enum BlockType {
        TRADE,
        DEPOSIT,
        ONCHAIN_WITHDRAW,
        OFFCHAIN_WITHDRAW,
        CANCEL
    }

    enum BlockState {
        COMMITTED,
        VERIFIED,
        FINALIZED
    }

    struct Wallet {
        address owner;
    }

    struct Operator {
        address payable owner;
        uint32 ID;
        uint32 activeOperatorIdx;
        uint amountStaked;
        uint32 unregisterTimestamp;
    }

    struct Account {
        address owner;
        uint24 walletID;
        bool withdrawn;
        uint publicKeyX;
        uint publicKeyY;
    }

    struct PendingDeposit {
        uint24 accountID;
        uint16 tokenID;
        uint96 amount;
    }

    struct DepositBlock {
        bytes32 hash;
        PendingDeposit[] pendingDeposits;

        uint16 numDeposits;
        uint fee;
        uint32 timestampOpened;
        uint32 timestampFilled;
    }

    struct WithdrawBlock {
        bytes32 hash;

        uint numWithdrawals;
        uint fee;
        uint32 timestampOpened;
        uint32 timestampFilled;
    }

    struct Block {
        bytes32 merkleRoot;

        bytes32 publicDataHash;

        BlockState state;

        uint32 timestamp;
        uint32 operatorID;
        uint32 numDepositBlocksCommitted;
        uint32 numWithdrawBlocksCommitted;
        bytes withdrawals;
    }

    struct State {
        address owner;
        uint depositFeeInETH;
        uint withdrawFeeInETH;
        uint maxWithdrawFeeInETH;
        bool closedOperatorRegistering;

        uint numAccounts;
        mapping (uint => Account) accounts;

        uint numBlocks;
        mapping (uint => Block) blocks;

        uint numDepositBlocks;
        mapping (uint => DepositBlock) depositBlocks;
        uint numWithdrawBlocks;
        mapping (uint => WithdrawBlock) withdrawBlocks;

        uint numWallets;
        mapping (uint => Wallet) wallets;

        uint numActiveOperators;
        uint totalNumOperators;
        mapping (uint => Operator) operators;
        mapping (uint32 => uint32) activeOperators;          // list idx -> operatorID
    }

    State[] private states;

    constructor(
        address _tokenRegistryAddress,
        address _blockVerifierAddress,
        address _lrcAddress
        )
        public
    {
        require(_tokenRegistryAddress != address(0x0), "ZERO_ADDRESS");
        require(_blockVerifierAddress != address(0x0), "ZERO_ADDRESS");
        require(_lrcAddress != address(0x0), "ZERO_ADDRESS");
        tokenRegistryAddress = _tokenRegistryAddress;
        blockVerifierAddress = _blockVerifierAddress;
        lrcAddress = _lrcAddress;
    }

    function createNewState(
        address owner,
        uint depositFeeInETH,
        uint withdrawFeeInETH,
        uint maxWithdrawFeeInETH,
        bool closedOperatorRegistering
        )
        external
    {
        State memory memoryState = State(
            owner,
            depositFeeInETH,
            withdrawFeeInETH,
            maxWithdrawFeeInETH,
            closedOperatorRegistering,
            0,
            0,
            1,
            1,
            1,
            0,
            0
        );
        states.push(memoryState);

        Block memory genesisBlock = Block(
            0x0b8b8f16f8442ddc83dddbeb0bde4ecbc23cef4436f72035e7f0f188d2843330,
            0x0,
            BlockState.FINALIZED,
            uint32(now),
            0xFFFFFFFF,
            0,
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

    function getDepositFee(
        uint32 stateID
        )
        external
        view
        returns (uint)
    {
        State storage state = getState(stateID);
        return state.depositFeeInETH;
    }

    function getWithdrawFee(
        uint32 stateID
        )
        external
        view
        returns (uint)
    {
        State storage state = getState(stateID);
        return state.withdrawFeeInETH;
    }

    function setStateFees(
        uint32 stateID,
        uint depositFee,
        uint withdrawFee
        )
        external
    {
        State storage state = getState(stateID);
        require(msg.sender == state.owner, "UNAUTHORIZED");
        require(withdrawFee <= state.maxWithdrawFeeInETH, "WITHDRAW_FEE_TOO_HIGH");

        state.depositFeeInETH = depositFee;
        state.withdrawFeeInETH = withdrawFee;
    }

    function commitBlock(
        uint blockType,
        uint burnRateBlockIdx,
        bytes memory data
        )
        public
    {
        uint32 stateID = 0;
        assembly {
            stateID := and(mload(add(data, 4)), 0xFFFFFFFF)
        }

        State storage state = getState(stateID);

        // This state cannot be in withdrawal mode
        require(!isInWithdrawalMode(stateID), "WITHDRAWAL_MODE_ACTIVE");

        // Check operator
        require(state.numActiveOperators > 0, "NO_ACTIVE_OPERATORS");
        Operator storage operator = state.operators[state.activeOperators[getActiveOperatorIdx(stateID)]];
        require(operator.owner == msg.sender, "SENDER_NOT_ACTIVE_OPERATOR");

        Block storage currentBlock = state.blocks[state.numBlocks - 1];

        // TODO: don't send before merkle tree roots to save on calldata

        bytes32 merkleRootBefore;
        bytes32 merkleRootAfter;
        assembly {
            merkleRootBefore := mload(add(data, 36))
            merkleRootAfter := mload(add(data, 68))
        }
        require(merkleRootBefore == currentBlock.merkleRoot, "INVALID_MERKLE_ROOT");

        uint32 numDepositBlocksCommitted = currentBlock.numDepositBlocksCommitted;
        uint32 numWithdrawBlocksCommitted = currentBlock.numWithdrawBlocksCommitted;
        if (blockType == uint(BlockType.TRADE)) {
            (bytes32 burnRateRootContract, uint32 burnRateRootValidUntil) =
                ITokenRegistry(tokenRegistryAddress).getBurnRateMerkleRoot(burnRateBlockIdx);
            bytes32 burnRateRoot;
            uint32 inputTimestamp;
            assembly {
                burnRateRoot := mload(add(data, 103))
                inputTimestamp := and(mload(add(data, 107)), 0xFFFFFFFF)
            }
            require(burnRateRoot == burnRateRootContract, "INVALID_BURNRATE_ROOT");
            require(now <= burnRateRootValidUntil, "BURNRATE_ROOT_TOO_OLD");
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
                        uint24(0),
                        uint16(0),
                        uint96(0)
                    )
                );
            }
            bytes32 depositBlockHash = depositBlock.hash;
            assembly {
                mstore(add(data, 100), depositBlockHash)
            }
            numDepositBlocksCommitted++;
        } else if (blockType == uint(BlockType.ONCHAIN_WITHDRAW)) {
            require(isWithdrawBlockCommittable(stateID, numWithdrawBlocksCommitted), "CANNOT_COMMIT_WITHDRAW_BLOCK_YET");
            WithdrawBlock storage withdrawBlock = state.withdrawBlocks[numWithdrawBlocksCommitted];
            // Pad the block so it's full
            for (uint i = withdrawBlock.numWithdrawals; i < NUM_WITHDRAWALS_IN_BLOCK; i++) {
                withdrawBlock.hash = sha256(
                    abi.encodePacked(
                        withdrawBlock.hash,
                        uint24(0),
                        uint16(0),
                        uint96(0)
                    )
                );
            }
            bytes32 withdrawBlockHash = withdrawBlock.hash;
            assembly {
                mstore(add(data, 103), withdrawBlockHash)
            }
            numWithdrawBlocksCommitted++;
        }

        // Check if we need to commit a deposit block
        require(!isWithdrawBlockForced(stateID, numWithdrawBlocksCommitted), "WITHDRAW_BLOCK_COMMIT_FORCED");
        require(!isDepositBlockForced(stateID, numDepositBlocksCommitted), "DEPOSIT_BLOCK_COMMIT_FORCED");

        bytes32 publicDataHash = sha256(data);

        // Create a new block with the updated merkle roots
        Block memory newBlock = Block(
            merkleRootAfter,
            publicDataHash,
            BlockState.COMMITTED,
            uint32(now),
            operator.ID,
            numDepositBlocksCommitted,
            numWithdrawBlocksCommitted,
            (blockType == uint(BlockType.ONCHAIN_WITHDRAW) ||
             blockType == uint(BlockType.OFFCHAIN_WITHDRAW)) ? data : new bytes(0)
        );
        state.blocks[state.numBlocks] = newBlock;
        state.numBlocks++;

        emit BlockCommitted(state.numBlocks - 1, publicDataHash);
    }

    function verifyBlock(
        uint32 stateID,
        uint blockIdx,
        uint256[8] memory proof
        )
        public
    {
        State storage state = getState(stateID);

        require(blockIdx < state.numBlocks, INVALID_VALUE);
        Block storage specifiedBlock = state.blocks[blockIdx];
        require(specifiedBlock.state == BlockState.COMMITTED, "BLOCK_ALREADY_VERIFIED");

        bool verified = IBlockVerifier(blockVerifierAddress).verifyProof(specifiedBlock.publicDataHash, proof);
        require(verified, "INVALID_PROOF");

        // Update state of this block and potentially the following blocks
        Block storage previousBlock = state.blocks[blockIdx - 1];
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
        uint32 stateID,
        uint32 blockIdx
        )
        external
    {
        State storage state = getState(stateID);

        require(blockIdx < state.numBlocks, "INVALID_BLOCKIDX");
        Block storage specifiedBlock = state.blocks[blockIdx];
        require(specifiedBlock.state == BlockState.COMMITTED, "INVALID_BLOCKSTATE");

        // The specified block needs to be the first block not finalized
        // (this way we always revert to a guaranteed valid block and don't need to revert multiple times)
        Block storage previousBlock = state.blocks[uint(blockIdx).sub(1)];
        require(previousBlock.state == BlockState.FINALIZED, "PREVIOUS_BLOCK_NOT_FINALIZED");

        // Check if this block is verified too late
        require(now > specifiedBlock.timestamp + MAX_PROOF_GENERATION_TIME_IN_SECONDS, "PROOF_NOT_TOO_LATE");

         // Burn the LRC staked
        Operator storage operator = state.operators[specifiedBlock.operatorID];
        assert(operator.amountStaked == STAKE_AMOUNT_IN_LRC);
        operator.amountStaked = 0;
        burn(address(this), STAKE_AMOUNT_IN_LRC);

        // Unregister the operator (if still registered)
        if (operator.unregisterTimestamp == 0) {
            unregisterOperatorInternal(stateID, specifiedBlock.operatorID);
        }

        // Remove all blocks after and including blockIdx;
        state.numBlocks = blockIdx;
    }

    function createAccountAndDeposit(
        uint32 stateID,
        uint publicKeyX,
        uint publicKeyY,
        uint24 walletID,
        uint16 tokenID,
        uint96 amount
        )
        public
        payable
        returns (uint24)
    {
        State storage state = getState(stateID);
        Account memory account = Account(
            msg.sender,
            walletID,
            false,
            publicKeyX,
            publicKeyY
        );
        uint24 accountID = uint24(state.numAccounts);
        state.accounts[accountID] = account;
        state.numAccounts++;
        require(state.numAccounts <= 2 ** 24, "TOO_MANY_ACCOUNTS");

        deposit(stateID, accountID, publicKeyX, publicKeyY, walletID, tokenID, amount);

        return accountID;
    }

    function depositToken(
        uint32 stateID,
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
        )
        public
        payable
    {
        State storage state = getState(stateID);
        Account storage account = state.accounts[accountID];
        deposit(stateID, accountID, account.publicKeyX, account.publicKeyY, account.walletID, tokenID, amount);
    }

    function deposit(
        uint32 stateID,
        uint24 accountID,
        uint publicKeyX,
        uint publicKeyY,
        uint24 walletID,
        uint16 tokenID,
        uint96 amount
        )
        public
        payable
    {
        State storage state = getState(stateID);

        Account storage account = state.accounts[accountID];
        // Dual author addresses are not allowed to be changed to normal addresses
        // (otherwise the burned fees cannot be forcibly withdrawn)
        if (account.walletID >=  MAX_NUM_WALLETS) {
            require(walletID >= MAX_NUM_WALLETS, "INVALID_WALLETID");
        }
        // Update account info
        account.walletID = walletID;
        account.publicKeyX = publicKeyX;
        account.publicKeyY = publicKeyY;

        // Check if msg.sender wants to create a dual author address for a wallet
        if (walletID >= MAX_NUM_WALLETS) {
            // Don't allow depositing to addresses like this
            require(amount == 0, "CANNOT_DEPOSIT_TO_DUAL_AUTHOR_ACCOUNTS");

            uint targetWalletID = walletID - MAX_NUM_WALLETS;
            if (targetWalletID > 0) {
                require(state.wallets[targetWalletID].owner == msg.sender, "CANNOT_CREATE_DUAL_AUTHOR_ACCOUNT_FOR_WALLET");
            }
        } else {
            require(account.owner == msg.sender, "UNAUTHORIZED");
        }

        // Check expected ETH value sent
        if (tokenID != 0) {
            require(msg.value == state.depositFeeInETH, "WRONG_ETH_VALUE");
        } else {
            require(msg.value == (state.depositFeeInETH + amount), "WRONG_ETH_VALUE");
        }

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

        depositBlock.fee = depositBlock.fee.add(state.depositFeeInETH);

        address tokenAddress = ITokenRegistry(tokenRegistryAddress).getTokenAddress(tokenID);
        if (amount > 0 && tokenID != 0) {
            // Transfer the tokens from the owner into this contract
            require(
                tokenAddress.safeTransferFrom(
                    account.owner,
                    address(this),
                    amount
                ),
                "UNSUFFICIENT_FUNDS"
            );
        }

        depositBlock.hash = sha256(
            abi.encodePacked(
                depositBlock.hash,
                accountID,
                publicKeyX,
                publicKeyY,
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
            tokenID,
            amount
        );
        depositBlock.pendingDeposits.push(pendingDeposit);
        emit Deposit(stateID, uint32(state.numDepositBlocks - 1), accountID, tokenID, walletID, amount);
    }

    function requestWithdraw(
        uint32 stateID,
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
        )
        external
        payable
    {
        require(amount > 0, INVALID_VALUE);

        State storage state = getState(stateID);

        // Check expected ETH value sent
        require(msg.value == state.withdrawFeeInETH, "WRONG_ETH_VALUE");

        Account storage account = state.accounts[accountID];
        // Allow anyone to withdraw wallet fees
        if (account.walletID < MAX_NUM_WALLETS) {
            require(account.owner == msg.sender, "UNAUTHORIZED");
        }

        // Get the withdraw block
        WithdrawBlock storage withdrawBlock = state.withdrawBlocks[state.numWithdrawBlocks - 1];
        if (isActiveWithdrawBlockClosed(stateID)) {
            state.numWithdrawBlocks++;
            withdrawBlock = state.withdrawBlocks[state.numWithdrawBlocks - 1];
        }
        if (withdrawBlock.numWithdrawals == 0) {
            withdrawBlock.timestampOpened = uint32(now);
        }
        require(withdrawBlock.numWithdrawals < NUM_WITHDRAWALS_IN_BLOCK, "WITHDRAW_BLOCK_FULL");

        withdrawBlock.fee = withdrawBlock.fee.add(state.withdrawFeeInETH);

        withdrawBlock.hash = sha256(
            abi.encodePacked(
                withdrawBlock.hash,
                accountID,
                tokenID,
                amount
            )
        );
        withdrawBlock.numWithdrawals++;
        if (withdrawBlock.numWithdrawals == NUM_WITHDRAWALS_IN_BLOCK) {
            withdrawBlock.timestampFilled = uint32(now);
        }

        emit WithdrawRequest(stateID, uint32(state.numWithdrawBlocks - 1), accountID, tokenID, amount);
    }

    function withdraw(
        uint32 stateID,
        uint blockIdx,
        uint withdrawalIdx
        )
        external
    {
        State storage state = getState(stateID);

        require(blockIdx < state.numBlocks, "INVALID_BLOCKIDX");
        Block storage withdrawBlock = state.blocks[blockIdx];
        require(withdrawBlock.state == BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

        // TODO: optimize
        bytes memory withdrawals = withdrawBlock.withdrawals;
        uint offset = 4 + 32 + 32 + 3 + 32 + (3 + 2 + 12 + 1) * (withdrawalIdx + 1);
        require(offset < withdrawals.length + 32, "INVALID_WITHDRAWALIDX");
        uint data;
        assembly {
            data := mload(add(withdrawals, offset))
        }
        uint24 accountID = uint24((data / 0x1000000000000000000000000000000) & 0xFFFFFF);
        uint16 tokenID = uint16((data / 0x100000000000000000000000000) & 0xFFFF);
        uint amount = (data / 0x100) & 0xFFFFFFFFFFFFFFFFFFFFFFFF;
        uint burnPercentage = data & 0xFF;

        assert(accountID < state.numAccounts);
        Account storage account = state.accounts[accountID];

        uint amountToBurn = amount.mul(burnPercentage) / 100;
        uint amountToOwner = amount - amountToBurn;

        if (amount > 0) {
            // Set the amount to 0 so it cannot be withdrawn anymore
            data = data & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF000000000000000000000000;
            assembly {
                mstore(add(withdrawals, offset), data)
            }
            withdrawBlock.withdrawals = withdrawals;

            // Transfer the tokens
            withdrawAndBurn(account.owner, tokenID, amountToOwner, amountToBurn);
        }

        emit Withdraw(stateID, accountID, tokenID, account.owner, uint96(amount));
    }

    function withdrawAndBurn(
        address accountOwner,
        uint16 tokenID,
        uint amountToOwner,
        uint amountToBurn
        )
        internal
    {
        address payable owner = address(uint160(accountOwner));

        // Transfer the tokens from the contract to the owner
        address token = ITokenRegistry(tokenRegistryAddress).getTokenAddress(tokenID);
        if (token == address(0x0)) {
            // ETH
            owner.transfer(amountToOwner);
        } else {
            // ERC20 token
            require(token.safeTransfer(owner, amountToOwner), TRANSFER_FAILURE);
        }

        // Increase the burn balance
        if (amountToBurn > 0) {
            burnBalances[token] = burnBalances[token].add(amountToBurn);
        }
    }

    function registerWallet(uint32 stateID)
        external
    {
        State storage state = getState(stateID);

        Wallet memory wallet = Wallet(
            msg.sender
        );
        state.wallets[state.numWallets] = wallet;
        state.numWallets++;
        require(state.numWallets <= MAX_NUM_WALLETS, "TOO_MANY_WALLETS");

        emit WalletRegistered(wallet.owner, uint24(state.numWallets - 1));
    }


    function registerOperator(
        uint32 stateID
        )
        external
    {
        State storage state = getState(stateID);

        if(state.closedOperatorRegistering) {
            require(msg.sender == state.owner, "ONLY_OWNER_CAN_REGISTER_OPERATORS");
        }

        // Move the LRC to this contract
        require(
            lrcAddress.safeTransferFrom(
                msg.sender,
                address(this),
                STAKE_AMOUNT_IN_LRC
            ),
            TRANSFER_FAILURE
        );

        // Add the operator
        Operator memory operator = Operator(
            msg.sender,
            uint32(state.totalNumOperators++),
            uint32(state.numActiveOperators++),
            STAKE_AMOUNT_IN_LRC,
            0
        );
        state.operators[operator.ID] = operator;
        uint maxNumOperators = 2 ** 32;
        require(state.totalNumOperators <= maxNumOperators, "TOO_MANY_OPERATORS");
        require(state.numActiveOperators <= maxNumOperators, "TOO_MANY_OPERATORS");

        emit OperatorRegistered(msg.sender, operator.ID);
    }

    function unregisterOperator(
        uint32 stateID,
        uint32 operatorID
        )
        external
    {
        State storage state = getState(stateID);

        require(operatorID < state.totalNumOperators, "INVALID_OPERATORIDX");
        Operator storage operator = state.operators[operatorID];
        require(msg.sender == operator.owner, "UNAUTHORIZED");

        unregisterOperatorInternal(stateID, operatorID);
    }

    function unregisterOperatorInternal(
        uint32 stateID,
        uint32 operatorID
        )
        internal
    {
        State storage state = getState(stateID);

        require(operatorID < state.totalNumOperators, "INVALID_OPERATORIDX");
        Operator storage operator = state.operators[operatorID];

        // Set the timestamp so we know when the operator is allowed to withdraw his staked LRC
        // (the operator could still have unproven blocks)
        operator.unregisterTimestamp = uint32(now);

        // Move the last operator to the slot of the operator we're unregistering
        require(state.numActiveOperators > 0, "NO_ACTIVE_OPERATORS");
        uint32 movedOperatorID = uint32(state.numActiveOperators - 1);
        Operator storage movedOperator = state.operators[movedOperatorID];
        state.activeOperators[operator.activeOperatorIdx] = movedOperatorID;
        movedOperator.activeOperatorIdx = operator.activeOperatorIdx;

        // Reduce the length of the array of active operators
        state.numActiveOperators--;
    }

    function getActiveOperatorIdx(
        uint32 stateID
        )
        public
        view
        returns (uint32)
    {
        State storage state = getState(stateID);

        if (state.numActiveOperators == 0) {
            return 0;
        }

        // Use a previous blockhash as the source of randomness
        // Keep the operator the same for 4 blocks
        bytes32 hash = blockhash(block.number - (block.number % 4));
        uint randomOperatorIdx = (uint(hash) % state.numActiveOperators);

        return uint32(randomOperatorIdx);
    }

    function withdrawOperatorStake(
        uint32 stateID,
        uint32 operatorID
        )
        external
    {
        State storage state = getState(stateID);

        //require(operatorID < state.totalNumOperators, "INVALID_OPERATORIDX");
        Operator storage operator = state.operators[operatorID];

        require(operator.unregisterTimestamp > 0, "OPERATOR_NOT_UNREGISTERED");
        require(now > operator.unregisterTimestamp + MIN_TIME_UNTIL_OPERATOR_CAN_WITHDRAWAL, "TOO_EARLY_TO_WITHDRAW");

        uint amount = operator.amountStaked;
        operator.amountStaked = 0;

        require(
            lrcAddress.safeTransfer(
                operator.owner,
                amount
            ),
            TRANSFER_FAILURE
        );
    }

    function withdrawBlockFee(
        uint32 stateID,
        uint32 blockIdx
        )
        external
    {
        State storage state = getState(stateID);

        require(blockIdx > 0, "INVALID_BLOCKIDX");
        require(blockIdx < state.numBlocks, "INVALID_BLOCKIDX");

        Block storage requestedBlock = state.blocks[blockIdx];
        Block storage previousBlock = state.blocks[blockIdx - 1];

        require(requestedBlock.state == BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

        address payable operator = state.operators[requestedBlock.operatorID].owner;

        uint fee = 0;
        if(requestedBlock.numDepositBlocksCommitted > previousBlock.numDepositBlocksCommitted) {
            fee = state.depositBlocks[previousBlock.numDepositBlocksCommitted].fee;
            state.depositBlocks[previousBlock.numDepositBlocksCommitted].fee = 0;
        } else if (requestedBlock.numWithdrawBlocksCommitted > previousBlock.numWithdrawBlocksCommitted) {
            fee = state.withdrawBlocks[previousBlock.numWithdrawBlocksCommitted].fee;
            state.withdrawBlocks[previousBlock.numWithdrawBlocksCommitted].fee = 0;
        } else {
            revert("BLOCK_HAS_NO_OPERATOR_FEE");
        }
        require(fee == 0, "FEE_ALREADY_WITHDRAWN");

        operator.transfer(fee);

        emit BlockFeeWithdraw(stateID, blockIdx, operator, fee);
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
            "BURN_FAILURE"
        );
    }

    function withdrawBurned(
        address token,
        uint amount
        )
        external
        returns (bool success)
    {
        // TODO: should only be callable by BurnManager
        require(burnBalances[token] >= amount, "AMOUNT_TOO_HIGH");
        burnBalances[token] = burnBalances[token].sub(amount);

        // Token transfer needs to be done after the state changes to prevent a reentrancy attack
        success = token.safeTransfer(msg.sender, amount);
        require(success, "TRANSFER_FAILURE");

        emit WithdrawBurned(token, amount);

        return success;
    }

    function getState(
        uint32 stateID
        )
        internal
        view
        returns (State storage state)
    {
        require(stateID < states.length, "INVALID_STATEID");
        state = states[stateID];
    }

    function getBlockIdx(
        uint32 stateID
        )
        external
        view
        returns (uint)
    {
        State storage state = getState(stateID);
        return state.numBlocks.sub(1);
    }

    function isActiveDepositBlockClosed(
        uint32 stateID
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
        State storage state = getState(stateID);
        DepositBlock storage depositBlock = state.depositBlocks[state.numDepositBlocks - 1];
        if ((depositBlock.numDeposits == NUM_DEPOSITS_IN_BLOCK && now > depositBlock.timestampOpened + MIN_TIME_BLOCK_OPEN) ||
            (depositBlock.numDeposits > 0 && now > depositBlock.timestampOpened + MAX_TIME_BLOCK_OPEN)) {
            return true;
        } else {
            return false;
        }
    }

    function isDepositBlockCommittable(
        uint32 stateID,
        uint32 depositBlockIdx
        )
        internal
        view
        returns (bool)
    {
        State storage state = getState(stateID);
        //require(depositBlockIdx < state.numDepositBlocks, "INVALID_DEPOSITBLOCK_IDX_COMMIT");
        DepositBlock storage depositBlock = state.depositBlocks[depositBlockIdx];
        if ((depositBlock.numDeposits == NUM_DEPOSITS_IN_BLOCK && now > depositBlock.timestampFilled + MIN_TIME_BLOCK_CLOSED_UNTIL_COMMITTABLE) ||
            (depositBlock.numDeposits > 0 && now > depositBlock.timestampOpened + MAX_TIME_BLOCK_OPEN + MIN_TIME_BLOCK_CLOSED_UNTIL_COMMITTABLE)) {
            return true;
        } else {
            return false;
        }
    }

    function isDepositBlockForced(
        uint32 stateID,
        uint32 depositBlockIdx
        )
        internal
        view
        returns (bool)
    {
        State storage state = getState(stateID);
        //require(depositBlockIdx <= state.numDepositBlocks, "INVALID_DEPOSITBLOCK_IDX_FORCED");
        DepositBlock storage depositBlock = state.depositBlocks[depositBlockIdx];
        if ((depositBlock.numDeposits == NUM_DEPOSITS_IN_BLOCK && now > depositBlock.timestampFilled + MAX_TIME_BLOCK_CLOSED_UNTIL_FORCED) ||
            (depositBlock.numDeposits > 0 && now > depositBlock.timestampOpened + MAX_TIME_BLOCK_OPEN + MAX_TIME_BLOCK_CLOSED_UNTIL_FORCED)) {
            return true;
        } else {
            return false;
        }
    }

    function getNumAvailableDepositSlots(
        uint32 stateID
        )
        external
        view
        returns (uint)
    {
        if (isActiveDepositBlockClosed(stateID)) {
            return NUM_DEPOSITS_IN_BLOCK;
        } else {
            State storage state = getState(stateID);
            DepositBlock storage depositBlock = state.depositBlocks[state.numDepositBlocks - 1];
            return NUM_DEPOSITS_IN_BLOCK - depositBlock.numDeposits;
        }
    }


    function isActiveWithdrawBlockClosed(
        uint32 stateID
        )
        internal
        view
        returns (bool)
    {
        // When to create a new withdraw block:
        // - block is full: the old block needs to be at least MIN_TIME_OPEN_BLOCK seconds old
        //                  (so we don't saturate the operators with deposits)
        // - block is partially full: the old block is at least MAX_TIME_OPEN_BLOCK seconds old
        //                            (so we can guarantee a maximum amount of time to the users
        //                             when the deposits will be available)
        State storage state = getState(stateID);
        WithdrawBlock storage withdrawBlock = state.withdrawBlocks[state.numWithdrawBlocks - 1];
        if ((withdrawBlock.numWithdrawals == NUM_WITHDRAWALS_IN_BLOCK && now > withdrawBlock.timestampOpened + MIN_TIME_BLOCK_OPEN) ||
            (withdrawBlock.numWithdrawals > 0 && now > withdrawBlock.timestampOpened + MAX_TIME_BLOCK_OPEN)) {
            return true;
        } else {
            return false;
        }
    }

    function isWithdrawBlockCommittable(
        uint32 stateID,
        uint32 withdrawBlockIdx
        )
        internal
        view
        returns (bool)
    {
        State storage state = getState(stateID);
        //require(withdrawBlockIdx < state.numWithdrawBlocks, "INVALID_WITHDRAWBLOCK_IDX_COMMIT");
        WithdrawBlock storage withdrawBlock = state.withdrawBlocks[withdrawBlockIdx];
        if ((withdrawBlock.numWithdrawals == NUM_WITHDRAWALS_IN_BLOCK && now > withdrawBlock.timestampFilled + MIN_TIME_BLOCK_CLOSED_UNTIL_COMMITTABLE) ||
            (withdrawBlock.numWithdrawals > 0 && now > withdrawBlock.timestampOpened + MAX_TIME_BLOCK_OPEN + MIN_TIME_BLOCK_CLOSED_UNTIL_COMMITTABLE)) {
            return true;
        } else {
            return false;
        }
    }

    function isWithdrawBlockForced(
        uint32 stateID,
        uint32 withdrawBlockIdx
        )
        internal
        view
        returns (bool)
    {
        State storage state = getState(stateID);
        //require(withdrawBlockIdx <= state.numWithdrawBlocks, "INVALID_WITHDRAWBLOCK_IDX_FORCED");
        WithdrawBlock storage withdrawBlock = state.withdrawBlocks[withdrawBlockIdx];
        if ((withdrawBlock.numWithdrawals == NUM_WITHDRAWALS_IN_BLOCK && now > withdrawBlock.timestampFilled + MAX_TIME_BLOCK_CLOSED_UNTIL_FORCED) ||
            (withdrawBlock.numWithdrawals > 0 && now > withdrawBlock.timestampOpened + MAX_TIME_BLOCK_OPEN + MAX_TIME_BLOCK_CLOSED_UNTIL_FORCED)) {
            return true;
        } else {
            return false;
        }
    }

    function getNumAvailableWithdrawSlots(
        uint32 stateID
        )
        external
        view
        returns (uint)
    {
        if (isActiveWithdrawBlockClosed(stateID)) {
            return NUM_WITHDRAWALS_IN_BLOCK;
        } else {
            State storage state = getState(stateID);
            WithdrawBlock storage withdrawBlock = state.withdrawBlocks[state.numWithdrawBlocks - 1];
            return NUM_WITHDRAWALS_IN_BLOCK - withdrawBlock.numWithdrawals;
        }
    }

    function isInWithdrawalMode(
        uint32 stateID
        )
        public
        view
        returns (bool)
    {
        State storage state = getState(stateID);
        Block storage currentBlock = state.blocks[state.numBlocks - 1];
        WithdrawBlock storage withdrawBlock = state.withdrawBlocks[currentBlock.numWithdrawBlocksCommitted];
        DepositBlock storage depositBlock = state.depositBlocks[currentBlock.numDepositBlocksCommitted];
        return (withdrawBlock.timestampOpened > now + MAX_TIME_BLOCK_UNTIL_WITHDRAWALMODE ||
                depositBlock.timestampOpened > now + MAX_TIME_BLOCK_UNTIL_WITHDRAWALMODE);
    }
/*
    function withdrawFromMerkleTree(
        uint32 stateID,
        uint24 accountID,
        uint16 tokenID,
        uint256[24] calldata accountPath,
        uint256[16] calldata tokenPath,
        uint32 nonce,
        uint96 balance,
        uint96 burnBalance,
        uint256 tradeHistoryRoot
        )
        external
        returns (bool)
    {
        // This state cannot be in withdrawal mode
        require(isInWithdrawalMode(stateID), "WITHDRAWAL_MODE_NOT_ACTIVE");

        State storage state = getState(stateID);
        Account storage account = state.accounts[accountID];
        require(account.withdrawn == false, "BALANCE_ALREADY_WITHDRAWN");

        // Verify data
        uint256 balancesRoot = getBalancesRoot(
            tokenID,
            balance,
            burnBalance,
            tradeHistoryRoot,
            tokenPath
        );
        uint256 accountsRoot = getAccountsRoot(
            accountID,
            account,
            nonce,
            balancesRoot,
            accountPath
        );
        Block storage currentBlock = state.blocks[state.numBlocks - 1];
        require(accountsRoot == uint256(currentBlock.merkleRoot), "INVALID_MERKLE_TREE_DATA");

        // Make sure the balance can only be withdrawn once
        account.withdrawn = true;

        // Transfer the tokens
        withdrawAndBurn(account.owner, tokenID, balance, burnBalance);
    }

    function getBalancesRoot(
        uint16 tokenID,
        uint balance,
        uint burnBalance,
        uint tradeHistoryRoot,
        uint256[16] memory tokenPath
        )
        internal
        returns (uint256)
    {
        uint256[29] memory IVs;
        FillLevelIVs(IVs);

        uint256[] memory balanceLeafElements = new uint256[](3);
        balanceLeafElements[0] = balance;
        balanceLeafElements[1] = burnBalance;
        balanceLeafElements[2] = tradeHistoryRoot;
        uint256 balanceItem = MiMC.Hash(balanceLeafElements);

        // Calculate merkle root of balances tree
        uint tokenAddress = tokenID;
        for (uint depth = 0; depth < 16; depth++) {
            if (tokenAddress & 1 == 1) {
                balanceItem = HashImpl(tokenPath[depth], balanceItem, IVs[depth]);
            } else {
                balanceItem = HashImpl(balanceItem, tokenPath[depth], IVs[depth]);
            }
            tokenAddress = tokenAddress / 2;
        }
        return balanceItem;
    }

    function getAccountsRoot(
        uint24 accountID,
        Account storage account,
        uint nonce,
        uint balancesRoot,
        uint256[24] memory accountPath
        )
        internal
        returns (uint256)
    {
        uint256[29] memory IVs;
        FillLevelIVs(IVs);

        uint256[] memory accountLeafElements = new uint256[](5);
        accountLeafElements[0] = account.publicKeyX;
        accountLeafElements[1] = account.publicKeyY;
        accountLeafElements[2] = account.walletID;
        accountLeafElements[3] = nonce;
        accountLeafElements[4] = balancesRoot;
        uint256 accountItem = MiMC.Hash(accountLeafElements);

        uint accountAddress = accountID;
        for (uint depth = 0; depth < 24; depth++) {
            if (accountAddress & 1 == 1) {
                accountItem = HashImpl(accountPath[depth], accountItem, IVs[depth]);
            } else {
                accountItem = HashImpl(accountItem, accountPath[depth], IVs[depth]);
            }
            accountAddress = accountAddress / 2;
        }
        return accountItem;
    }

    function withdrawFromPendingDeposit(
        uint32 stateID,
        uint depositBlockIdx,
        uint slotIdx
        )
        external
        returns (bool)
    {
        // This state cannot be in withdrawal mode
        require(isInWithdrawalMode(stateID), "WITHDRAWAL_MODE_NOT_ACTIVE");

        State storage state = getState(stateID);
        Block storage latestBlock = state.blocks[state.numBlocks - 1];
        require (depositBlockIdx >= latestBlock.numDepositBlocksCommitted, "DEPOSIT_BLOCK_CANNOT_BE_COMMITTED");

        PendingDeposit storage pendingDeposit = state.depositBlocks[depositBlockIdx].pendingDeposits[slotIdx];
        uint amount = pendingDeposit.amount;

        // Set the amount to 0 so it cannot be withdrawn again
        pendingDeposit.amount = 0;

        // Transfer the tokens
        Account storage account = state.accounts[pendingDeposit.accountID];
        withdrawAndBurn(account.owner, pendingDeposit.tokenID, amount, 0);
    }

    function HashImpl (
        uint256 left,
        uint256 right,
        uint256 IV
        )
        internal
        pure
        returns (uint256)
    {
        uint256[] memory x = new uint256[](2);
        x[0] = left;
        x[1] = right;

        return MiMC.Hash(x, IV);
    }

    function FillLevelIVs (
        uint256[29] memory IVs
        )
        internal
        pure
    {
        IVs[0] = 149674538925118052205057075966660054952481571156186698930522557832224430770;
        IVs[1] = 9670701465464311903249220692483401938888498641874948577387207195814981706974;
        IVs[2] = 18318710344500308168304415114839554107298291987930233567781901093928276468271;
        IVs[3] = 6597209388525824933845812104623007130464197923269180086306970975123437805179;
        IVs[4] = 21720956803147356712695575768577036859892220417043839172295094119877855004262;
        IVs[5] = 10330261616520855230513677034606076056972336573153777401182178891807369896722;
        IVs[6] = 17466547730316258748333298168566143799241073466140136663575045164199607937939;
        IVs[7] = 18881017304615283094648494495339883533502299318365959655029893746755475886610;
        IVs[8] = 21580915712563378725413940003372103925756594604076607277692074507345076595494;
        IVs[9] = 12316305934357579015754723412431647910012873427291630993042374701002287130550;
        IVs[10] = 18905410889238873726515380969411495891004493295170115920825550288019118582494;
        IVs[11] = 12819107342879320352602391015489840916114959026915005817918724958237245903353;
        IVs[12] = 8245796392944118634696709403074300923517437202166861682117022548371601758802;
        IVs[13] = 16953062784314687781686527153155644849196472783922227794465158787843281909585;
        IVs[14] = 19346880451250915556764413197424554385509847473349107460608536657852472800734;
        IVs[15] = 14486794857958402714787584825989957493343996287314210390323617462452254101347;
        IVs[16] = 11127491343750635061768291849689189917973916562037173191089384809465548650641;
        IVs[17] = 12217916643258751952878742936579902345100885664187835381214622522318889050675;
        IVs[18] = 722025110834410790007814375535296040832778338853544117497481480537806506496;
        IVs[19] = 15115624438829798766134408951193645901537753720219896384705782209102859383951;
        IVs[20] = 11495230981884427516908372448237146604382590904456048258839160861769955046544;
        IVs[21] = 16867999085723044773810250829569850875786210932876177117428755424200948460050;
        IVs[22] = 1884116508014449609846749684134533293456072152192763829918284704109129550542;
        IVs[23] = 14643335163846663204197941112945447472862168442334003800621296569318670799451;
        IVs[24] = 1933387276732345916104540506251808516402995586485132246682941535467305930334;
        IVs[25] = 7286414555941977227951257572976885370489143210539802284740420664558593616067;
        IVs[26] = 16932161189449419608528042274282099409408565503929504242784173714823499212410;
        IVs[27] = 16562533130736679030886586765487416082772837813468081467237161865787494093536;
        IVs[28] = 6037428193077828806710267464232314380014232668931818917272972397574634037180;
    }
*/
}
