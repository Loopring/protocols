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

import "../iface/IBlockVerifier.sol";
import "../iface/IExchange.sol";
import "../iface/IExchangeHelper.sol";
import "../iface/IOperatorRegistry.sol";
import "../iface/ITokenRegistry.sol";

import "../lib/BurnableERC20.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";
import "../lib/NoDefaultFunc.sol";


/// @title An Implementation of IExchange.
/// @author Brecht Devos - <brecht@loopring.org>,
contract Exchange is IExchange, NoDefaultFunc
{
    using MathUint          for uint;
    using ERC20SafeTransfer for address;

    uint32 public constant MAX_PROOF_GENERATION_TIME_IN_SECONDS         = 1 hours;

    uint32 public constant MIN_TIME_BLOCK_OPEN                          = 1  minutes;
    uint32 public constant MAX_TIME_BLOCK_OPEN                          = 15 minutes;
    uint32 public constant MIN_TIME_BLOCK_CLOSED_UNTIL_COMMITTABLE      = 2  minutes;

    //uint32 public constant MAX_TIME_BLOCK_CLOSED_UNTIL_FORCED           = 15 minutes;
    uint32 public constant MAX_TIME_BLOCK_CLOSED_UNTIL_FORCED           = 1 days;     // TESTING

    uint32 public constant MAX_TIME_BLOCK_UNTIL_WITHDRAWALMODE          = 1 days;     // TESTING

    uint16 public constant NUM_DEPOSITS_IN_BLOCK                        = 8;
    uint16 public constant NUM_WITHDRAWALS_IN_BLOCK                     = 8;

    //uint32 public constant TIMESTAMP_WINDOW_SIZE_IN_SECONDS           = 1 minutes;
    uint32 public constant TIMESTAMP_WINDOW_SIZE_IN_SECONDS             = 1 days;        // TESTING

    // Default account
    uint public constant DEFAULT_ACCOUNT_PUBLICKEY_X = 2760979366321990647384327991146539505488430080750363450053902718557853404165;
    uint public constant DEFAULT_ACCOUNT_PUBLICKEY_Y = 10771439851340068599303586501499035409517957710739943668636844002715618931667;
    uint public constant DEFAULT_ACCOUNT_SECRETKEY   = 531595266505639429282323989096889429445309320547115026296307576144623272935;

    address public lrcAddress                = address(0x0);
    address public exchangeHelperAddress     = address(0x0);
    address public tokenRegistryAddress      = address(0x0);
    address public blockVerifierAddress      = address(0x0);

    enum BlockType
    {
        SETTLEMENT,
        DEPOSIT,
        ONCHAIN_WITHDRAW,
        OFFCHAIN_WITHDRAW,
        CANCEL
    }

    enum BlockState
    {
        COMMITTED,
        VERIFIED,
        FINALIZED
    }

    struct Wallet
    {
        address owner;
    }

    struct Account
    {
        address owner;
        bool   withdrawn;
        uint   publicKeyX;
        uint   publicKeyY;
    }

    struct PendingDeposit
    {
        uint24 accountID;
        uint16 tokenID;
        uint96 amount;
    }

    struct DepositBlock
    {
        bytes32 hash;
        PendingDeposit[] pendingDeposits;

        uint16 numDeposits;
        uint   fee;
        uint32 timestampOpened;
        uint32 timestampFilled;
    }

    struct WithdrawBlock
    {
        bytes32 hash;
        uint    numWithdrawals;
        uint    fee;
        uint32  timestampOpened;
        uint32  timestampFilled;
    }

    struct Block
    {
        bytes32 merkleRoot;
        bytes32 publicDataHash;

        BlockState state;

        uint32 timestamp;
        uint32 numDepositBlocksCommitted;
        uint32 numWithdrawBlocksCommitted;
        bytes  withdrawals;
    }

    uint32 dexID;
    address payable exchangeOwner;
    uint public depositFee = 0;
    uint public withdrawFee = 0;
    uint public maxWithdrawFee = 0;

    Account[] accounts;
    Block[] blocks;

    uint numDepositBlocks = 1;
    mapping (uint => DepositBlock) depositBlocks;
    uint numWithdrawBlocks = 1;
    mapping (uint => WithdrawBlock) withdrawBlocks;

    constructor(
        address _exchangeHelperAddress,
        address _tokenRegistryAddress,
        address _blockVerifierAddress,
        address _lrcAddress,
        address payable _exchangeOwner,
        uint32 _dexID,
        uint _maxWithdrawFee
        )
        public
    {
        require(_exchangeHelperAddress != address(0x0), "ZERO_ADDRESS");
        require(_tokenRegistryAddress != address(0x0), "ZERO_ADDRESS");
        require(_blockVerifierAddress != address(0x0), "ZERO_ADDRESS");
        require(_lrcAddress != address(0x0), "ZERO_ADDRESS");
        require(_exchangeOwner != address(0x0), "ZERO_ADDRESS");

        exchangeHelperAddress = _exchangeHelperAddress;
        tokenRegistryAddress = _tokenRegistryAddress;
        blockVerifierAddress = _blockVerifierAddress;
        lrcAddress = _lrcAddress;
        exchangeOwner = _exchangeOwner;
        dexID = _dexID;
        maxWithdrawFee = _maxWithdrawFee;

        Block memory genesisBlock = Block(
            0x29c496a5d270dec45f84b17ac910e27e342b7feaff48ba1d717e7d3dd622d9ed,
            0x0,
            BlockState.FINALIZED,
            uint32(now),
            0,
            0,
            new bytes(0)
        );
        blocks.push(genesisBlock);
    }

    function setFees(
        uint _depositFee,
        uint _withdrawFee
        )
        external
    {
        // require(msg.sender == exchangeOwner, "UNAUTHORIZED");
        require(withdrawFee <= maxWithdrawFee, "TOO_LARGE_AMOUNT");

        depositFee = _depositFee;
        withdrawFee = _withdrawFee;
    }

    function getDepositFee()
        external
        view
        returns (uint)
    {
        return depositFee;
    }

    function getWithdrawFee()
        external
        view
        returns (uint)
    {
        return withdrawFee;
    }

    function commitBlock(
        uint blockType,
        bytes memory data
        )
        public
    {
        // require(msg.sender == exchangeOwner, "UNAUTHORIZED");

        // Extract the dexID from the data
        uint32 dexIDInData = 0;
        assembly {
            dexIDInData := and(mload(add(data, 4)), 0xFFFFFFFF)
        }
        require(dexIDInData == dexID, "INVALID_DEXID");

        // Exchange cannot be in withdraw mode
        require(!isInWithdrawMode(), "IN_WITHDRAW_MODE");

        // Get the current block
        Block storage currentBlock = blocks[blocks.length - 1];

        bytes32 merkleRootBefore;
        bytes32 merkleRootAfter;
        assembly {
            merkleRootBefore := mload(add(data, 36))
            merkleRootAfter := mload(add(data, 68))
        }
        require(merkleRootBefore == currentBlock.merkleRoot, "INVALID_MERKLE_ROOT");

        uint32 numDepositBlocksCommitted = currentBlock.numDepositBlocksCommitted;
        uint32 numWithdrawBlocksCommitted = currentBlock.numWithdrawBlocksCommitted;
        if (blockType == uint(BlockType.SETTLEMENT)) {
            uint32 inputTimestamp;
            assembly {
                inputTimestamp := and(mload(add(data, 75)), 0xFFFFFFFF)
            }
            require(
                inputTimestamp > now - TIMESTAMP_WINDOW_SIZE_IN_SECONDS &&
                inputTimestamp < now + TIMESTAMP_WINDOW_SIZE_IN_SECONDS,
                "INVALID_TIMESTAMP"
            );
        } else if (blockType == uint(BlockType.DEPOSIT)) {
            require(
                isDepositBlockCommittable(numDepositBlocksCommitted),
                "CANNOT_COMMIT_BLOCK_YET"
            );

            DepositBlock storage depositBlock = depositBlocks[numDepositBlocksCommitted];
            bytes32 depositBlockHash = depositBlock.hash;
            // Pad the block so it's full
            for (uint i = depositBlock.numDeposits; i < NUM_DEPOSITS_IN_BLOCK; i++) {
                depositBlockHash = sha256(
                    abi.encodePacked(
                        depositBlockHash,
                        uint24(0),
                        DEFAULT_ACCOUNT_PUBLICKEY_X,
                        DEFAULT_ACCOUNT_PUBLICKEY_Y,
                        uint24(0),
                        uint16(0),
                        uint96(0)
                    )
                );
            }
            assembly {
                mstore(add(data, 100), depositBlockHash)
            }
            numDepositBlocksCommitted++;
        } else if (blockType == uint(BlockType.ONCHAIN_WITHDRAW)) {
            require(
                isWithdrawBlockCommittable(numWithdrawBlocksCommitted),
                "CANNOT_COMMIT_BLOCK_YET"
            );

            WithdrawBlock storage withdrawBlock = withdrawBlocks[numWithdrawBlocksCommitted];
            bytes32 withdrawBlockHash = withdrawBlock.hash;
            // Pad the block so it's full
            for (uint i = withdrawBlock.numWithdrawals; i < NUM_WITHDRAWALS_IN_BLOCK; i++) {
                withdrawBlockHash = sha256(
                    abi.encodePacked(
                        withdrawBlockHash,
                        uint24(0),
                        uint16(0),
                        uint96(0)
                    )
                );
            }
            assembly {
                mstore(add(data, 103), withdrawBlockHash)
            }
            numWithdrawBlocksCommitted++;
        }

        // Check if we need to commit a deposit or withdraw block
        require(!isWithdrawBlockForced(numWithdrawBlocksCommitted), "BLOCK_COMMIT_FORCED");
        require(!isDepositBlockForced(numDepositBlocksCommitted), "BLOCK_COMMIT_FORCED");

        bytes32 publicDataHash = sha256(data);

        // Create a new block with the updated merkle roots
        Block memory newBlock = Block(
            merkleRootAfter,
            publicDataHash,
            BlockState.COMMITTED,
            uint32(now),
            numDepositBlocksCommitted,
            numWithdrawBlocksCommitted,
            (blockType == uint(BlockType.ONCHAIN_WITHDRAW) ||
             blockType == uint(BlockType.OFFCHAIN_WITHDRAW)) ? data : new bytes(0)
        );
        blocks.push(newBlock);

        emit BlockCommitted(blocks.length - 1, publicDataHash);
    }

    function verifyBlock(
        uint blockIdx,
        uint256[8] calldata proof
        )
        external
    {
        // Exchange cannot be in withdraw mode
        require(!isInWithdrawMode(), "IN_WITHDRAW_MODE");

        require(blockIdx < blocks.length, "INVALID_BLOCK_IDX");
        Block storage specifiedBlock = blocks[blockIdx];
        require(specifiedBlock.state == BlockState.COMMITTED, "BLOCK_VERIFIED_ALREADY");

        require(
            IBlockVerifier(blockVerifierAddress).verifyProof(
                specifiedBlock.publicDataHash, proof
            ),
            "INVALID_PROOF"
        );

        // Update state of this block and potentially the following blocks
        Block storage previousBlock = blocks[blockIdx - 1];
        if (previousBlock.state == BlockState.FINALIZED) {
            specifiedBlock.state = BlockState.FINALIZED;
            emit BlockFinalized(blockIdx);
            // The next blocks could become finalized as well so check this now
            // The number of blocks after the specified block index is limited
            // so we don't have to worry about running out of gas in this loop
            uint nextBlockIdx = blockIdx + 1;
            while (nextBlockIdx < blocks.length &&
                blocks[nextBlockIdx].state == BlockState.VERIFIED) {

                blocks[nextBlockIdx].state = BlockState.FINALIZED;
                emit BlockFinalized(nextBlockIdx);
                nextBlockIdx++;
            }
        } else {
            specifiedBlock.state = BlockState.VERIFIED;
        }
    }

    function revertBlock(
        uint32 blockIdx
        )
        external
    {
        require(blockIdx < blocks.length, "INVALID_BLOCK_IDX");
        Block storage specifiedBlock = blocks[blockIdx];
        require(specifiedBlock.state == BlockState.COMMITTED, "INVALID_BLOCK_STATE");

        // The specified block needs to be the first block not finalized
        // (this way we always revert to a guaranteed valid block and don't need to revert multiple times)
        Block storage previousBlock = blocks[uint(blockIdx).sub(1)];
        require(previousBlock.state == BlockState.FINALIZED, "PREV_BLOCK_NOT_FINALIZED");

        // Check if this block is verified too late
        require(
            now > specifiedBlock.timestamp + MAX_PROOF_GENERATION_TIME_IN_SECONDS,
            "TOO_LATE_PROOF"
        );

        // Eject operator
        /*IOperatorRegistry(operatorRegistryAddress).ejectOperator(
            realmID,
            specifiedBlock.operatorID
        );*/

        // Remove all blocks after and including blockIdx
        blocks.length = blockIdx;

        emit Revert(blockIdx);
    }

    function createAccount(
        uint publicKeyX,
        uint publicKeyY,
        uint16 tokenID,
        uint96 amount
        )
        public
        payable
        returns (uint24)
    {
        require(accounts.length < 2 ** 24, "TOO_MANY_ACCOUNTS");

        Account memory account = Account(
            msg.sender,
            false,
            publicKeyX,
            publicKeyY
        );
        accounts.push(account);

        uint24 accountID = uint24(accounts.length - 1);

        updateAccount(
            accountID,
            publicKeyX,
            publicKeyY,
            tokenID,
            amount
        );

        return accountID;
    }

    // Q(daniel): should we create another method that doesn't require
    // the accountID param and use the msg.sender to find the accountId?
    function deposit(
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
        )
        external
        payable
    {
        Account storage account = getAccount(accountID);
        updateAccount(
            accountID,
            account.publicKeyX,
            account.publicKeyY,
            tokenID,
            amount
        );
    }

    function updateAccount(
        uint24 accountID,
        uint publicKeyX,
        uint publicKeyY,
        uint16 tokenID,
        uint96 amount
        )
        public
        payable
    {
        // Realm cannot be in withdraw mode
        require(!isInWithdrawMode(), "IN_WITHDRAW_MODE");

        Account storage account = getAccount(accountID);

        // Update account info
        if (!isFeeRecipientAccount(account)) {
            account.publicKeyX = publicKeyX;
            account.publicKeyY = publicKeyY;
        } else {
            require(amount == 0, "CANNOT_DEPOSIT_TO_FEE_RECIPIENT_ACCOUNTS");
        }

        // Check expected ETH value sent
        // Q(daniel): we'd better check `msg.value >= depositFee` because exact equal is hard
        if (tokenID != 0) {
            require(msg.value == depositFee, "INVALID_VALUE");
        } else {
            require(msg.value == (depositFee + amount), "INVALID_VALUE");
        }

        // Get the deposit block
        DepositBlock storage depositBlock = depositBlocks[numDepositBlocks - 1];
        if (isActiveDepositBlockClosed()) {
            numDepositBlocks++;
            depositBlock = depositBlocks[numDepositBlocks - 1];
            depositBlock.timestampOpened = uint32(now);
        } else {
            require(depositBlock.numDeposits < NUM_DEPOSITS_IN_BLOCK, "BLOCK_FULL");
        }

        // Increase the fee for this block
        depositBlock.fee = depositBlock.fee.add(depositFee);

        // Transfer the tokens from the owner into this contract
        address tokenAddress = ITokenRegistry(tokenRegistryAddress).getTokenAddress(tokenID);
        if (amount > 0 && tokenID != 0) {
            require(
                tokenAddress.safeTransferFrom(
                    account.owner,
                    address(this),
                    amount
                ),
                "INSUFFICIENT_FUND"
            );
        }

        // Update the deposit block hash
        depositBlock.hash = sha256(
            abi.encodePacked(
                depositBlock.hash,
                accountID,
                publicKeyX,
                publicKeyY,
                uint24(0),
                tokenID,
                amount
            )
        );
        depositBlock.numDeposits++;

        if (depositBlock.numDeposits == NUM_DEPOSITS_IN_BLOCK) {
            depositBlock.timestampFilled = uint32(now);
        }

        // Store deposit info onchain so we can withdraw from uncommitted deposit blocks
        // Q(daniel): should we extend to pending depoits and emit event only if amount > 0?
        PendingDeposit memory pendingDeposit = PendingDeposit(
            accountID,
            tokenID,
            amount
        );
        depositBlock.pendingDeposits.push(pendingDeposit);


        emit Deposit(
            uint32(numDepositBlocks - 1), uint16(depositBlock.numDeposits - 1),
            accountID, tokenID, amount
        );
    }

    // Q(daniel): also create a meothod without having to specify accountId.
    // Maybe allow amount == 0 to withdrawa all outstanding balance.
    function requestWithdraw(
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
        )
        external
        payable
    {
        // Realm cannot be in withdraw mode
        require(!isInWithdrawMode(), "IN_WITHDRAW_MODE");
        require(amount > 0, "INVALID_VALUE");

        // Check expected ETH value sent
        require(msg.value == withdrawFee, "INVALID_VALUE");

        Account storage account = getAccount(accountID);
        // Allow anyone to withdraw from fee accounts
        if (!isFeeRecipientAccount(account)) {
            require(account.owner == msg.sender, "UNAUTHORIZED");
        }

        // Get the withdraw block
        WithdrawBlock storage withdrawBlock = withdrawBlocks[numWithdrawBlocks - 1];


        if (isActiveWithdrawBlockClosed()) {
            numWithdrawBlocks++;
            withdrawBlock = withdrawBlocks[numWithdrawBlocks - 1];
            withdrawBlock.timestampOpened = uint32(now);
        } else {
            require(withdrawBlock.numWithdrawals < NUM_WITHDRAWALS_IN_BLOCK, "BLOCK_FULL");
        }

        // Increase the fee for this block
        withdrawBlock.fee = withdrawBlock.fee.add(withdrawFee);

        // Update the withdraw block hash
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

        //  Q(daniel): we don't have something like the following for withdrawal...
        //
        //  PendingDeposit memory pendingDeposit = PendingDeposit(
        //     accountID,
        //     tokenID,
        //     amount
        // );
        // depositBlock.pendingDeposits.push(pendingDeposit);

        emit WithdrawRequest(
            uint32(numWithdrawBlocks - 1),
            uint16(withdrawBlock.numWithdrawals - 1),
            accountID,
            tokenID,
            amount
        );
    }

    // For a wallet or a user, how to find the value of slotIdx?
    // Is it a good idea to give each withdrawal an unique id then keep a map
    // from this id to "block index and slot idx index"; if the withdrawal (request) id
    // is incremental, we can also keep a maxProcessedWithdrawalRequestId in the smart contract.
    // Maybe this is also applicable to deposit.
    function withdraw(
        uint blockIdx,
        uint slotIdx
        )
        external
    {
        require(blockIdx < blocks.length, "INVALID_BLOCK_IDX");
        Block storage withdrawBlock = blocks[blockIdx];

        // Only allow withdrawing on finalized blocks
        require(withdrawBlock.state == BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

        // Get the withdraw data of the given slot
        // TODO: optimize
        bytes memory withdrawals = withdrawBlock.withdrawals;
        uint offset = 4 + 32 + 32 + 3 + 32 + (3 + 2 + 12) * (slotIdx + 1);

        // Q(daniel): this should be `INVAliD_SLOT_IDX`?
        require(offset < withdrawals.length + 32, "INVALID_BLOCK_IDX");
        uint data;
        assembly {
            data := mload(add(withdrawals, offset))
        }

        // Extract the data
        uint24 accountID = uint24((data / 0x10000000000000000000000000000) & 0xFFFFFF);
        uint16 tokenID = uint16((data / 0x1000000000000000000000000) & 0xFFFF);
        uint amount = data & 0xFFFFFFFFFFFFFFFFFFFFFFFF;

        Account storage account = getAccount(accountID);

        if (amount > 0) {
            // Set the amount to 0 so it cannot be withdrawn anymore
            data = data & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF000000000000000000000000;
            assembly {
                mstore(add(withdrawals, offset), data)
            }
            withdrawBlock.withdrawals = withdrawals;

            // Transfer the tokens
            withdrawAndBurn(account.owner, tokenID, amount, isFeeRecipientAccount(account));
        }

        emit Withdraw(accountID, tokenID, account.owner, uint96(amount));
    }

    function withdrawAndBurn(
        address accountOwner,
        uint16 tokenID,
        uint amount,
        bool bBurn
        )
        internal
    {
        // Calculate how much needs to get burned
        uint amountToBurn = 0;
        uint amountToOwner = 0;
        if (bBurn) {
            uint burnRate = ITokenRegistry(tokenRegistryAddress).getBurnRate(tokenID);
            amountToBurn = amount.mul(burnRate) / 10000;
            amountToOwner = amount - amountToBurn;
        } else {
            amountToBurn = 0;
            amountToOwner = amount;
        }

        address payable owner = address(uint160(accountOwner));
        address token = ITokenRegistry(tokenRegistryAddress).getTokenAddress(tokenID);

        // Increase the burn balance
        if (amountToBurn > 0) {
            burnBalances[token] = burnBalances[token].add(amountToBurn);
        }

        // Transfer the tokens from the contract to the owner
        if (amountToOwner > 0) {
            if (token == address(0x0)) {
                // ETH
                owner.transfer(amountToOwner);
            } else {
                // ERC20 token
                require(token.safeTransfer(owner, amountToOwner), "TRANSFER_FAILURE");
            }
        }
    }

    function withdrawBlockFee(
        uint32 blockIdx
        )
        external
        returns (bool)
    {
        // require(msg.sender == exchangeOwner, "UNAUTHORIZED");
        require(blockIdx > 0 && blockIdx < blocks.length, "INVALID_BLOCK_IDX");
        Block storage requestedBlock = blocks[blockIdx];
        Block storage previousBlock = blocks[blockIdx - 1];

        require(requestedBlock.state == BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

        uint fee = 0;
        if(requestedBlock.numDepositBlocksCommitted > previousBlock.numDepositBlocksCommitted) {
            fee = depositBlocks[previousBlock.numDepositBlocksCommitted].fee;
            depositBlocks[previousBlock.numDepositBlocksCommitted].fee = 0;
        } else if (
            requestedBlock.numWithdrawBlocksCommitted > previousBlock.numWithdrawBlocksCommitted) {
            fee = withdrawBlocks[previousBlock.numWithdrawBlocksCommitted].fee;
            withdrawBlocks[previousBlock.numWithdrawBlocksCommitted].fee = 0;
        } else {
            revert("BLOCK_HAS_NO_OPERATOR_FEE");
        }
        require(fee == 0, "FEE_WITHDRAWN_ALREADY");

        exchangeOwner.transfer(fee);

        emit BlockFeeWithdraw(blockIdx, fee);

        return true;
    }

    function withdrawBurned(
        address token,
        uint amount
        )
        external
        returns (bool success)
    {
        // TODO: should only be callable by BurnManager
        require(burnBalances[token] >= amount, "TOO_LARGE_AMOUNT");
        burnBalances[token] = burnBalances[token].sub(amount);

        // Token transfer needs to be done after the state changes to prevent a reentrancy attack
        success = token.safeTransfer(msg.sender, amount);
        require(success, "TRANSFER_FAILURE");

        emit WithdrawBurned(token, amount);

        return success;
    }

    function getAccount(
        uint24 accountID
        )
        internal
        view
        returns (Account storage account)
    {
        require(accountID < accounts.length, "INVALID_ACCOUNT_ID");
        account = accounts[accountID];
    }

    function getBlockIdx()
        external
        view
        returns (uint)
    {
        return blocks.length.sub(1);
    }

    function isActiveDepositBlockClosed()
        internal
        view
        returns (bool)
    {
        DepositBlock storage depositBlock = depositBlocks[numDepositBlocks - 1];
        return isActiveOnchainBlockClosed(
            depositBlock.numDeposits,
            NUM_DEPOSITS_IN_BLOCK,
            depositBlock.timestampOpened
        );
    }

    function isDepositBlockCommittable(
        uint32 depositBlockIdx
        )
        internal
        view
        returns (bool)
    {
        assert(depositBlockIdx < numDepositBlocks);
        DepositBlock storage depositBlock = depositBlocks[depositBlockIdx];
        return isOnchainBlockCommittable(
            depositBlock.numDeposits,
            NUM_DEPOSITS_IN_BLOCK,
            depositBlock.timestampOpened,
            depositBlock.timestampFilled
        );
    }

    function isDepositBlockForced(
        uint32 depositBlockIdx
        )
        internal
        view
        returns (bool)
    {
        assert(depositBlockIdx <= numDepositBlocks);
        DepositBlock storage depositBlock = depositBlocks[depositBlockIdx];
        return isOnchainBlockForced(
            depositBlock.numDeposits,
            NUM_DEPOSITS_IN_BLOCK,
            depositBlock.timestampOpened,
            depositBlock.timestampFilled
        );
    }

    function getNumAvailableDepositSlots()
        external
        view
        returns (uint)
    {
        if (isActiveDepositBlockClosed()) {
            return NUM_DEPOSITS_IN_BLOCK;
        } else {
            DepositBlock storage depositBlock = depositBlocks[numDepositBlocks - 1];
            return NUM_DEPOSITS_IN_BLOCK - depositBlock.numDeposits;
        }
    }


    function isActiveWithdrawBlockClosed()
        internal
        view
        returns (bool)
    {
        WithdrawBlock storage withdrawBlock = withdrawBlocks[numWithdrawBlocks - 1];
        return isActiveOnchainBlockClosed(
            withdrawBlock.numWithdrawals,
            NUM_WITHDRAWALS_IN_BLOCK,
            withdrawBlock.timestampOpened
        );
    }

    function isWithdrawBlockCommittable(
        uint32 withdrawBlockIdx
        )
        internal
        view
        returns (bool)
    {
        assert(withdrawBlockIdx < numWithdrawBlocks);
        WithdrawBlock storage withdrawBlock = withdrawBlocks[withdrawBlockIdx];
        return isOnchainBlockCommittable(
            withdrawBlock.numWithdrawals,
            NUM_WITHDRAWALS_IN_BLOCK,
            withdrawBlock.timestampOpened,
            withdrawBlock.timestampFilled
        );
    }

    function isWithdrawBlockForced(
        uint32 withdrawBlockIdx
        )
        internal
        view
        returns (bool)
    {
        assert(withdrawBlockIdx <= numWithdrawBlocks);
        WithdrawBlock storage withdrawBlock = withdrawBlocks[withdrawBlockIdx];
        return isOnchainBlockForced(
            withdrawBlock.numWithdrawals,
            NUM_WITHDRAWALS_IN_BLOCK,
            withdrawBlock.timestampOpened,
            withdrawBlock.timestampFilled
        );
    }

    function getNumAvailableWithdrawSlots()
        external
        view
        returns (uint)
    {
        if (isActiveWithdrawBlockClosed()) {
            return NUM_WITHDRAWALS_IN_BLOCK;
        } else {
            WithdrawBlock storage withdrawBlock = withdrawBlocks[numWithdrawBlocks - 1];
            return NUM_WITHDRAWALS_IN_BLOCK - withdrawBlock.numWithdrawals;
        }
    }

    function isInWithdrawMode()
        public
        view
        returns (bool)
    {
        Block storage currentBlock = blocks[blocks.length - 1];
        WithdrawBlock storage withdrawBlock =
            withdrawBlocks[currentBlock.numWithdrawBlocksCommitted];

        DepositBlock storage depositBlock =
            depositBlocks[currentBlock.numDepositBlocksCommitted];

        return isOnchainBlockTooLate(depositBlock.timestampOpened) ||
                   isOnchainBlockTooLate(withdrawBlock.timestampOpened);
    }

    function isActiveOnchainBlockClosed(
        uint count,
        uint maxCount,
        uint32 timestampOpened
        )
        internal
        view
        returns (bool)
    {
        if ((count == maxCount && now > timestampOpened + MIN_TIME_BLOCK_OPEN) ||
                (count > 0 && now > timestampOpened + MAX_TIME_BLOCK_OPEN)) {
            return true;
        } else {
            return false;
        }
    }

    function isOnchainBlockCommittable(
        uint count,
        uint maxCount,
        uint timestampOpened,
        uint timestampFilled
        )
        internal
        view
        returns (bool)
    {
        if ((count == maxCount && now > timestampFilled + MIN_TIME_BLOCK_CLOSED_UNTIL_COMMITTABLE) ||
                (count > 0 && now > timestampOpened + MAX_TIME_BLOCK_OPEN + MIN_TIME_BLOCK_CLOSED_UNTIL_COMMITTABLE)) {
            return true;
        } else {
            return false;
        }
    }

    function isOnchainBlockForced(
        uint count,
        uint maxCount,
        uint timestampOpened,
        uint timestampFilled
        )
        internal
        view
        returns (bool)
    {
        if ((count == maxCount && now > timestampFilled + MAX_TIME_BLOCK_CLOSED_UNTIL_FORCED) ||
                (count > 0 && now > timestampOpened + MAX_TIME_BLOCK_OPEN + MAX_TIME_BLOCK_CLOSED_UNTIL_FORCED)) {
            return true;
        } else {
            return false;
        }
    }

    function isOnchainBlockTooLate(
        uint timestampOpened
        )
        public
        view
        returns (bool)
    {
        return (timestampOpened != 0 && timestampOpened + MAX_TIME_BLOCK_UNTIL_WITHDRAWALMODE < now);
    }

    function isFeeRecipientAccount(
        Account storage account
        )
        internal
        view
        returns (bool)
    {
        return account.publicKeyX == 0 && account.publicKeyY == 0;
    }

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
        returns (bool)
    {
        require(isInWithdrawMode(), "NOT_IN_WITHDRAW_MODE");

        Block storage lastBlock = blocks[blocks.length - 1];
        require(lastBlock.state == BlockState.FINALIZED, "PREV_BLOCK_NOT_FINALIZED");

        Account storage account = getAccount(accountID);
        require(account.withdrawn == false, "WITHDRAWN_ALREADY");

        verifyAccountBalance(
            lastBlock.merkleRoot,
            accountID,
            tokenID,
            accountPath,
            balancePath,
            account,
            nonce,
            balance,
            tradeHistoryRoot
        );

        // Make sure the balance can only be withdrawn once
        account.withdrawn = true;

        // Transfer the tokens
        withdrawAndBurn(account.owner, tokenID, balance, isFeeRecipientAccount(account));

        return true;
    }

    function verifyAccountBalance(
        bytes32 merkleRoot,
        uint24 accountID,
        uint16 tokenID,
        uint256[24] memory accountPath,
        uint256[12] memory balancePath,
        Account storage account,
        uint32 nonce,
        uint96 balance,
        uint256 tradeHistoryRoot
        )
        internal
    {
        IExchangeHelper(exchangeHelperAddress).verifyAccountBalance(
            uint256(merkleRoot),
            accountID,
            tokenID,
            accountPath,
            balancePath,
            account.publicKeyX,
            account.publicKeyY,
            0,
            nonce,
            balance,
            tradeHistoryRoot
        );
    }

    function withdrawFromPendingDeposit(
        uint depositBlockIdx,
        uint slotIdx
        )
        external
        returns (bool)
    {
        require(isInWithdrawMode(), "NOT_IN_WITHDRAW_MODE");

        Block storage lastBlock = blocks[blocks.length - 1];
        require(lastBlock.state == BlockState.FINALIZED, "PREV_BLOCK_NOT_FINALIZED");

        require (depositBlockIdx >= lastBlock.numDepositBlocksCommitted, "BLOCK_COMMITTED_ALREADY");

        require(depositBlockIdx < numDepositBlocks, "INVALID_BLOCK_IDX");
        require(
            slotIdx < depositBlocks[depositBlockIdx].pendingDeposits.length,
            "INVALID_SLOT_IDX"
        );

        PendingDeposit storage pendingDeposit =
            depositBlocks[depositBlockIdx].pendingDeposits[slotIdx];

        uint amount = pendingDeposit.amount;
        require(amount > 0, "WITHDRAWN_ALREADY");

        // Set the amount to 0 so it cannot be withdrawn again
        pendingDeposit.amount = 0;

        // Transfer the tokens
        Account storage account = getAccount(pendingDeposit.accountID);
        withdrawAndBurn(account.owner, pendingDeposit.tokenID, amount, isFeeRecipientAccount(account));
    }

}
