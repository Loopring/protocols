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

    uint   public constant MAX_NUM_WALLETS                              = 2 ** 23;

    // Default account
    uint public constant DEFAULT_ACCOUNT_PUBLICKEY_X = 2760979366321990647384327991146539505488430080750363450053902718557853404165;
    uint public constant DEFAULT_ACCOUNT_PUBLICKEY_Y = 10771439851340068599303586501499035409517957710739943668636844002715618931667;
    uint public constant DEFAULT_ACCOUNT_SECRETKEY   = 531595266505639429282323989096889429445309320547115026296307576144623272935;

    address public lrcAddress                = address(0x0);
    address public exchangeHelperAddress     = address(0x0);
    address public tokenRegistryAddress      = address(0x0);
    address public operatorRegistryAddress   = address(0x0);
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
        uint24 walletID;
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
        uint32 operatorID;
        uint32 numDepositBlocksCommitted;
        uint32 numWithdrawBlocksCommitted;
        bytes  withdrawals;
    }

    struct Realm
    {
        address owner;
        uint depositFeeInETH;
        uint withdrawFeeInETH;
        uint maxWithdrawFeeInETH;

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
    }

    Realm[] private realms;

    constructor(
        address _exchangeHelperAddress,
        address _tokenRegistryAddress,
        address _operatorRegistryAddress,
        address _blockVerifierAddress,
        address _lrcAddress
        )
        public
    {
        require(_exchangeHelperAddress != address(0x0), "ZERO_ADDRESS");
        require(_tokenRegistryAddress != address(0x0), "ZERO_ADDRESS");
        require(_operatorRegistryAddress != address(0x0), "ZERO_ADDRESS");
        require(_blockVerifierAddress != address(0x0), "ZERO_ADDRESS");
        require(_lrcAddress != address(0x0), "ZERO_ADDRESS");

        exchangeHelperAddress = _exchangeHelperAddress;
        tokenRegistryAddress = _tokenRegistryAddress;
        operatorRegistryAddress = _operatorRegistryAddress;
        blockVerifierAddress = _blockVerifierAddress;
        lrcAddress = _lrcAddress;
    }

    function createRealm(
        address owner,
        uint depositFeeInETH,
        uint withdrawFeeInETH,
        uint maxWithdrawFeeInETH,
        bool closedOperatorRegistering
        )
        external
    {
        realms.push(
            Realm(
                owner,
                depositFeeInETH,
                withdrawFeeInETH,
                maxWithdrawFeeInETH,
                0,
                0,
                1,
                1,
                1
            )
        );

        Block memory genesisBlock = Block(
            0x29c496a5d270dec45f84b17ac910e27e342b7feaff48ba1d717e7d3dd622d9ed,
            0x0,
            BlockState.FINALIZED,
            uint32(now),
            0xFFFFFFFF,
            0,
            0,
            new bytes(0)
        );
        Realm storage realm = realms[realms.length - 1];
        realm.blocks[realm.numBlocks] = genesisBlock;
        realm.numBlocks++;

        IOperatorRegistry(operatorRegistryAddress).createRealm(
            owner,
            closedOperatorRegistering
        );

        emit RealmCreated(uint16(realms.length - 1), owner);

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
        uint32 realmID
        )
        external
        view
        returns (uint)
    {
        Realm storage realm = getRealm(realmID);
        return realm.depositFeeInETH;
    }

    function getWithdrawFee(
        uint32 realmID
        )
        external
        view
        returns (uint)
    {
        Realm storage realm = getRealm(realmID);
        return realm.withdrawFeeInETH;
    }

    function setRealmFees(
        uint32 realmID,
        uint depositFee,
        uint withdrawFee
        )
        external
    {
        Realm storage realm = getRealm(realmID);
        require(msg.sender == realm.owner, "UNAUTHORIZED");
        require(withdrawFee <= realm.maxWithdrawFeeInETH, "TOO_LARGE_AMOUNT");

        realm.depositFeeInETH = depositFee;
        realm.withdrawFeeInETH = withdrawFee;
    }

    function commitBlock(
        uint blockType,
        bytes memory data
        )
        public
    {
        uint32 realmID = 0;
        assembly {
            realmID := and(mload(add(data, 4)), 0xFFFFFFFF)
        }

        Realm storage realm = getRealm(realmID);

        // Realm cannot be in withdraw mode
        require(!isInWithdrawMode(realmID), "IN_WITHDRAW_MODE");

        // Get active operator
        uint32 operatorID = IOperatorRegistry(operatorRegistryAddress).getActiveOperatorID(realmID);
        address operatorOwner = IOperatorRegistry(operatorRegistryAddress).getOperatorOwner(realmID, operatorID);
        require(operatorOwner == msg.sender, "UNAUTHORIZED");

        Block storage currentBlock = realm.blocks[realm.numBlocks - 1];

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
                isDepositBlockCommittable(realmID, numDepositBlocksCommitted),
                "CANNOT_COMMIT_BLOCK_YET"
            );

            DepositBlock storage depositBlock = realm.depositBlocks[numDepositBlocksCommitted];
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
                isWithdrawBlockCommittable(realmID, numWithdrawBlocksCommitted),
                "CANNOT_COMMIT_BLOCK_YET"
            );

            WithdrawBlock storage withdrawBlock = realm.withdrawBlocks[numWithdrawBlocksCommitted];
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
        require(!isWithdrawBlockForced(realmID, numWithdrawBlocksCommitted), "BLOCK_COMMIT_FORCED");
        require(!isDepositBlockForced(realmID, numDepositBlocksCommitted), "BLOCK_COMMIT_FORCED");

        bytes32 publicDataHash = sha256(data);

        // Create a new block with the updated merkle roots
        Block memory newBlock = Block(
            merkleRootAfter,
            publicDataHash,
            BlockState.COMMITTED,
            uint32(now),
            operatorID,
            numDepositBlocksCommitted,
            numWithdrawBlocksCommitted,
            (blockType == uint(BlockType.ONCHAIN_WITHDRAW) ||
             blockType == uint(BlockType.OFFCHAIN_WITHDRAW)) ? data : new bytes(0)
        );
        realm.blocks[realm.numBlocks] = newBlock;
        realm.numBlocks++;

        emit BlockCommitted(realmID, realm.numBlocks - 1, publicDataHash);
    }

    function verifyBlock(
        uint32 realmID,
        uint blockIdx,
        uint256[8] calldata proof
        )
        external
    {
        // Realm cannot be in withdraw mode
        require(!isInWithdrawMode(realmID), "IN_WITHDRAW_MODE");

        Realm storage realm = getRealm(realmID);

        require(blockIdx < realm.numBlocks, "INVALID_BLOCK_IDX");
        Block storage specifiedBlock = realm.blocks[blockIdx];
        require(specifiedBlock.state == BlockState.COMMITTED, "BLOCK_VERIFIED_ALREADY");

        require(
            IBlockVerifier(blockVerifierAddress).verifyProof(
                specifiedBlock.publicDataHash, proof
            ),
            "INVALID_PROOF"
        );

        // Update state of this block and potentially the following blocks
        Block storage previousBlock = realm.blocks[blockIdx - 1];
        if (previousBlock.state == BlockState.FINALIZED) {
            specifiedBlock.state = BlockState.FINALIZED;
            emit BlockFinalized(realmID, blockIdx);
            // The next blocks could become finalized as well so check this now
            // The number of blocks after the specified block index is limited
            // so we don't have to worry about running out of gas in this loop
            uint nextBlockIdx = blockIdx + 1;
            while (nextBlockIdx < realm.numBlocks &&
                realm.blocks[nextBlockIdx].state == BlockState.VERIFIED) {

                realm.blocks[nextBlockIdx].state = BlockState.FINALIZED;
                emit BlockFinalized(realmID, nextBlockIdx);
                nextBlockIdx++;
            }
        } else {
            specifiedBlock.state = BlockState.VERIFIED;
        }
    }

    function revertBlock(
        uint32 realmID,
        uint32 blockIdx
        )
        external
    {
        Realm storage realm = getRealm(realmID);

        require(blockIdx < realm.numBlocks, "INVALID_BLOCK_IDX");
        Block storage specifiedBlock = realm.blocks[blockIdx];
        require(specifiedBlock.state == BlockState.COMMITTED, "INVALID_BLOCK_STATE");

        // The specified block needs to be the first block not finalized
        // (this way we always revert to a guaranteed valid block and don't need to revert multiple times)
        Block storage previousBlock = realm.blocks[uint(blockIdx).sub(1)];
        require(previousBlock.state == BlockState.FINALIZED, "PREV_BLOCK_NOT_FINALIZED");

        // Check if this block is verified too late
        require(
            now > specifiedBlock.timestamp + MAX_PROOF_GENERATION_TIME_IN_SECONDS,
            "TOO_LATE_PROOF"
        );

        // Eject operator
        IOperatorRegistry(operatorRegistryAddress).ejectOperator(
            realmID,
            specifiedBlock.operatorID
        );

        // Remove all blocks after and including blockIdx
        realm.numBlocks = blockIdx;

        emit Revert(realmID, blockIdx);
    }

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
        returns (uint24)
    {
        Realm storage realm = getRealm(realmID);
        Account memory account = Account(
            msg.sender,
            walletID,
            false,
            publicKeyX,
            publicKeyY
        );
        uint24 accountID = uint24(realm.numAccounts);
        realm.accounts[accountID] = account;
        realm.numAccounts++;
        require(realm.numAccounts <= 2 ** 24, "TOO_MANY_ACCOUNTS");

        updateAccount(
            realmID,
            accountID,
            publicKeyX,
            publicKeyY,
            walletID,
            tokenID,
            amount
        );

        return accountID;
    }

    function deposit(
        uint32 realmID,
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
        )
        external
        payable
    {
        Realm storage realm = getRealm(realmID);
        Account storage account = getAccount(realm, accountID);
        updateAccount(
            realmID,
            accountID,
            account.publicKeyX,
            account.publicKeyY,
            account.walletID,
            tokenID,
            amount
        );
    }

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
        payable
    {
        // Realm cannot be in withdraw mode
        require(!isInWithdrawMode(realmID), "IN_WITHDRAW_MODE");

        Realm storage realm = getRealm(realmID);

        Account storage account = getAccount(realm, accountID);
        // Account type cannot be changed
        if (account.walletID < MAX_NUM_WALLETS) {
            require(walletID < MAX_NUM_WALLETS, "INVALID_WALLET_ID_CHANGE");
        } else {
            require(walletID >= MAX_NUM_WALLETS, "INVALID_WALLET_ID_CHANGE");
        }
        // Update account info
        account.walletID = walletID;
        account.publicKeyX = publicKeyX;
        account.publicKeyY = publicKeyY;

        // Wallet needs to exist
        uint targetWalletID = walletID < MAX_NUM_WALLETS ? walletID : walletID - MAX_NUM_WALLETS;
        require(targetWalletID < realm.numWallets, "INVALID_WALLET_ID");

        // Check if msg.sender wants to create a dual author account for a wallet
        if (walletID < MAX_NUM_WALLETS) {
            // Don't allow depositing to accounts not owned by msg.sender so no tokens can be lost this way
            require(account.owner == msg.sender, "UNAUTHORIZED");
        } else {
            // Don't allow depositing to accounts like this
            require(amount == 0, "CANNOT_DEPOSIT_TO_DUAL_AUTHOR_ACCOUNTS");
            // Check if msg.sender is allowed to create accounts for this wallet
            if (targetWalletID > 0) {
                require(
                    realm.wallets[targetWalletID].owner == msg.sender,
                    "UNAUTHORIZED_FOR_DUAL_AUTHOR_ACCOUNT"
                );
            }
        }

        // Check expected ETH value sent
        if (tokenID != 0) {
            require(msg.value == realm.depositFeeInETH, "INVALID_VALUE");
        } else {
            require(msg.value == (realm.depositFeeInETH + amount), "INVALID_VALUE");
        }

        // Get the deposit block
        DepositBlock storage depositBlock = realm.depositBlocks[realm.numDepositBlocks - 1];
        if (isActiveDepositBlockClosed(realmID)) {
            realm.numDepositBlocks++;
            depositBlock = realm.depositBlocks[realm.numDepositBlocks - 1];
        }
        if (depositBlock.numDeposits == 0) {
            depositBlock.timestampOpened = uint32(now);
        }
        require(depositBlock.numDeposits < NUM_DEPOSITS_IN_BLOCK, "BLOCK_FULL");

        // Increase the fee for this block
        depositBlock.fee = depositBlock.fee.add(realm.depositFeeInETH);

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
                walletID,
                tokenID,
                amount
            )
        );
        depositBlock.numDeposits++;
        if (depositBlock.numDeposits == NUM_DEPOSITS_IN_BLOCK) {
            depositBlock.timestampFilled = uint32(now);
        }

        // Store deposit info onchain so we can withdraw from uncommitted deposit blocks
        PendingDeposit memory pendingDeposit = PendingDeposit(
            accountID,
            tokenID,
            amount
        );
        depositBlock.pendingDeposits.push(pendingDeposit);
        emit Deposit(
            realmID, uint32(realm.numDepositBlocks - 1), uint16(depositBlock.numDeposits - 1),
            accountID, tokenID, walletID, amount
        );
    }

    function requestWithdraw(
        uint32 realmID,
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
        )
        external
        payable
    {
        // Realm cannot be in withdraw mode
        require(!isInWithdrawMode(realmID), "IN_WITHDRAW_MODE");

        require(amount > 0, "INVALID_VALUE");

        Realm storage realm = getRealm(realmID);

        // Check expected ETH value sent
        require(msg.value == realm.withdrawFeeInETH, "INVALID_VALUE");

        Account storage account = getAccount(realm, accountID);
        // Allow anyone to withdraw from fee accounts
        if (account.walletID < MAX_NUM_WALLETS) {
            require(account.owner == msg.sender, "UNAUTHORIZED");
        }

        // Get the withdraw block
        WithdrawBlock storage withdrawBlock = realm.withdrawBlocks[realm.numWithdrawBlocks - 1];
        if (isActiveWithdrawBlockClosed(realmID)) {
            realm.numWithdrawBlocks++;
            withdrawBlock = realm.withdrawBlocks[realm.numWithdrawBlocks - 1];
        }
        if (withdrawBlock.numWithdrawals == 0) {
            withdrawBlock.timestampOpened = uint32(now);
        }
        require(withdrawBlock.numWithdrawals < NUM_WITHDRAWALS_IN_BLOCK, "BLOCK_FULL");

        // Increase the fee for this block
        withdrawBlock.fee = withdrawBlock.fee.add(realm.withdrawFeeInETH);

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

        emit WithdrawRequest(
            realmID,
            uint32(realm.numWithdrawBlocks - 1),
            uint16(withdrawBlock.numWithdrawals - 1),
            accountID,
            tokenID,
            amount
        );
    }

    function withdraw(
        uint32 realmID,
        uint blockIdx,
        uint slotIdx
        )
        external
    {
        Realm storage realm = getRealm(realmID);

        require(blockIdx < realm.numBlocks, "INVALID_BLOCK_IDX");
        Block storage withdrawBlock = realm.blocks[blockIdx];

        // Only allow withdrawing on finalized blocks
        require(withdrawBlock.state == BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

        // Get the withdraw data of the given slot
        // TODO: optimize
        bytes memory withdrawals = withdrawBlock.withdrawals;
        uint offset = 4 + 32 + 32 + 3 + 32 + (3 + 2 + 12) * (slotIdx + 1);
        require(offset < withdrawals.length + 32, "INVALID_BLOCK_IDX");
        uint data;
        assembly {
            data := mload(add(withdrawals, offset))
        }

        // Extract the data
        uint24 accountID = uint24((data / 0x10000000000000000000000000000) & 0xFFFFFF);
        uint16 tokenID = uint16((data / 0x1000000000000000000000000) & 0xFFFF);
        uint amount = data & 0xFFFFFFFFFFFFFFFFFFFFFFFF;

        Account storage account = getAccount(realm, accountID);

        if (amount > 0) {
            // Set the amount to 0 so it cannot be withdrawn anymore
            data = data & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF000000000000000000000000;
            assembly {
                mstore(add(withdrawals, offset), data)
            }
            withdrawBlock.withdrawals = withdrawals;

            // Transfer the tokens
            withdrawAndBurn(account.owner, tokenID, account.walletID, amount);
        }

        emit Withdraw(realmID, accountID, tokenID, account.owner, uint96(amount));
    }

    function withdrawAndBurn(
        address accountOwner,
        uint16 tokenID,
        uint24 walletID,
        uint amount
        )
        internal
    {
        // Calculate how much needs to get burned
        uint amountToBurn = 0;
        uint amountToOwner = 0;
        if (walletID >= MAX_NUM_WALLETS) {
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

    function registerWallet(
        uint32 realmID
        )
        external
    {
        // Realm cannot be in withdraw mode
        require(!isInWithdrawMode(realmID), "IN_WITHDRAW_MODE");

        Realm storage realm = getRealm(realmID);

        Wallet memory wallet = Wallet(
            msg.sender
        );
        realm.wallets[realm.numWallets] = wallet;
        realm.numWallets++;
        require(realm.numWallets <= MAX_NUM_WALLETS, "TOO_MANY_WALLETS");

        emit WalletRegistered(wallet.owner, uint24(realm.numWallets - 1));
    }


    function withdrawBlockFee(
        uint32 realmID,
        uint32 blockIdx
        )
        external
        returns (bool)
    {
        Realm storage realm = getRealm(realmID);

        require(blockIdx > 0 && blockIdx < realm.numBlocks, "INVALID_BLOCK_IDX");
        Block storage requestedBlock = realm.blocks[blockIdx];
        Block storage previousBlock = realm.blocks[blockIdx - 1];

        require(requestedBlock.state == BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

        address payable operator = IOperatorRegistry(operatorRegistryAddress).getOperatorOwner(
            realmID,
            requestedBlock.operatorID
        );

        uint fee = 0;
        if(requestedBlock.numDepositBlocksCommitted > previousBlock.numDepositBlocksCommitted) {
            fee = realm.depositBlocks[previousBlock.numDepositBlocksCommitted].fee;
            realm.depositBlocks[previousBlock.numDepositBlocksCommitted].fee = 0;
        } else if (
            requestedBlock.numWithdrawBlocksCommitted > previousBlock.numWithdrawBlocksCommitted) {
            fee = realm.withdrawBlocks[previousBlock.numWithdrawBlocksCommitted].fee;
            realm.withdrawBlocks[previousBlock.numWithdrawBlocksCommitted].fee = 0;
        } else {
            revert("BLOCK_HAS_NO_OPERATOR_FEE");
        }
        require(fee == 0, "FEE_WITHDRAWN_ALREADY");

        operator.transfer(fee);

        emit BlockFeeWithdraw(realmID, blockIdx, operator, fee);

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

    function getRealm(
        uint32 realmID
        )
        internal
        view
        returns (Realm storage realm)
    {
        require(realmID < realms.length, "INVALID_REALM_ID");
        realm = realms[realmID];
    }

    function getAccount(
        Realm storage realm,
        uint24 accountID
        )
        internal
        view
        returns (Account storage account)
    {
        require(accountID < realm.numAccounts, "INVALID_ACCOUNT_ID");
        account = realm.accounts[accountID];
    }

    function getBlockIdx(
        uint32 realmID
        )
        external
        view
        returns (uint)
    {
        Realm storage realm = getRealm(realmID);
        return realm.numBlocks.sub(1);
    }

    function isActiveDepositBlockClosed(
        uint32 realmID
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
        Realm storage realm = getRealm(realmID);
        DepositBlock storage depositBlock = realm.depositBlocks[realm.numDepositBlocks - 1];
        if ((depositBlock.numDeposits == NUM_DEPOSITS_IN_BLOCK &&
            now > depositBlock.timestampOpened + MIN_TIME_BLOCK_OPEN) ||
            (depositBlock.numDeposits > 0 &&
                now > depositBlock.timestampOpened + MAX_TIME_BLOCK_OPEN)) {
            return true;
        } else {
            return false;
        }
    }

    function isDepositBlockCommittable(
        uint32 realmID,
        uint32 depositBlockIdx
        )
        internal
        view
        returns (bool)
    {
        Realm storage realm = getRealm(realmID);
        assert(depositBlockIdx < realm.numDepositBlocks);
        DepositBlock storage depositBlock = realm.depositBlocks[depositBlockIdx];
        if ((depositBlock.numDeposits == NUM_DEPOSITS_IN_BLOCK &&
            now > depositBlock.timestampFilled + MIN_TIME_BLOCK_CLOSED_UNTIL_COMMITTABLE) ||
            (depositBlock.numDeposits > 0 &&
                now > depositBlock.timestampOpened +
                MAX_TIME_BLOCK_OPEN +
                MIN_TIME_BLOCK_CLOSED_UNTIL_COMMITTABLE)) {
            return true;
        } else {
            return false;
        }
    }

    function isDepositBlockForced(
        uint32 realmID,
        uint32 depositBlockIdx
        )
        internal
        view
        returns (bool)
    {
        Realm storage realm = getRealm(realmID);
        assert(depositBlockIdx <= realm.numDepositBlocks);
        DepositBlock storage depositBlock = realm.depositBlocks[depositBlockIdx];
        if ((depositBlock.numDeposits == NUM_DEPOSITS_IN_BLOCK &&
            now > depositBlock.timestampFilled + MAX_TIME_BLOCK_CLOSED_UNTIL_FORCED) ||
            (depositBlock.numDeposits > 0 &&
                now > depositBlock.timestampOpened +
                MAX_TIME_BLOCK_OPEN +
                MAX_TIME_BLOCK_CLOSED_UNTIL_FORCED)) {
            return true;
        } else {
            return false;
        }
    }

    function getNumAvailableDepositSlots(
        uint32 realmID
        )
        external
        view
        returns (uint)
    {
        if (isActiveDepositBlockClosed(realmID)) {
            return NUM_DEPOSITS_IN_BLOCK;
        } else {
            Realm storage realm = getRealm(realmID);
            DepositBlock storage depositBlock = realm.depositBlocks[realm.numDepositBlocks - 1];
            return NUM_DEPOSITS_IN_BLOCK - depositBlock.numDeposits;
        }
    }


    function isActiveWithdrawBlockClosed(
        uint32 realmID
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
        Realm storage realm = getRealm(realmID);
        WithdrawBlock storage withdrawBlock = realm.withdrawBlocks[realm.numWithdrawBlocks - 1];
        if ((withdrawBlock.numWithdrawals == NUM_WITHDRAWALS_IN_BLOCK &&
            now > withdrawBlock.timestampOpened + MIN_TIME_BLOCK_OPEN) ||
            (withdrawBlock.numWithdrawals > 0 &&
                now > withdrawBlock.timestampOpened + MAX_TIME_BLOCK_OPEN)) {
            return true;
        } else {
            return false;
        }
    }

    function isWithdrawBlockCommittable(
        uint32 realmID,
        uint32 withdrawBlockIdx
        )
        internal
        view
        returns (bool)
    {
        Realm storage realm = getRealm(realmID);
        assert(withdrawBlockIdx < realm.numWithdrawBlocks);
        WithdrawBlock storage withdrawBlock = realm.withdrawBlocks[withdrawBlockIdx];
        if ((withdrawBlock.numWithdrawals == NUM_WITHDRAWALS_IN_BLOCK &&
            now > withdrawBlock.timestampFilled + MIN_TIME_BLOCK_CLOSED_UNTIL_COMMITTABLE) ||
            (withdrawBlock.numWithdrawals > 0 &&
                now > withdrawBlock.timestampOpened +
                MAX_TIME_BLOCK_OPEN +
                MIN_TIME_BLOCK_CLOSED_UNTIL_COMMITTABLE)) {
            return true;
        } else {
            return false;
        }
    }

    function isWithdrawBlockForced(
        uint32 realmID,
        uint32 withdrawBlockIdx
        )
        internal
        view
        returns (bool)
    {
        Realm storage realm = getRealm(realmID);
        assert(withdrawBlockIdx <= realm.numWithdrawBlocks);
        WithdrawBlock storage withdrawBlock = realm.withdrawBlocks[withdrawBlockIdx];
        if ((withdrawBlock.numWithdrawals == NUM_WITHDRAWALS_IN_BLOCK &&
            now > withdrawBlock.timestampFilled + MAX_TIME_BLOCK_CLOSED_UNTIL_FORCED) ||
            (withdrawBlock.numWithdrawals > 0 &&
                now > withdrawBlock.timestampOpened +
                MAX_TIME_BLOCK_OPEN +
                MAX_TIME_BLOCK_CLOSED_UNTIL_FORCED)) {
            return true;
        } else {
            return false;
        }
    }

    function getNumAvailableWithdrawSlots(
        uint32 realmID
        )
        external
        view
        returns (uint)
    {
        if (isActiveWithdrawBlockClosed(realmID)) {
            return NUM_WITHDRAWALS_IN_BLOCK;
        } else {
            Realm storage realm = getRealm(realmID);
            WithdrawBlock storage withdrawBlock = realm.withdrawBlocks[realm.numWithdrawBlocks - 1];
            return NUM_WITHDRAWALS_IN_BLOCK - withdrawBlock.numWithdrawals;
        }
    }

    function isInWithdrawMode(
        uint32 realmID
        )
        public
        view
        returns (bool)
    {
        Realm storage realm = getRealm(realmID);
        Block storage currentBlock = realm.blocks[realm.numBlocks - 1];
        WithdrawBlock storage withdrawBlock =
            realm.withdrawBlocks[currentBlock.numWithdrawBlocksCommitted];

        DepositBlock storage depositBlock =
            realm.depositBlocks[currentBlock.numDepositBlocksCommitted];

        return ((withdrawBlock.timestampOpened != 0 &&
            withdrawBlock.timestampOpened + MAX_TIME_BLOCK_UNTIL_WITHDRAWALMODE < now) ||
                (depositBlock.timestampOpened != 0 &&
                    depositBlock.timestampOpened + MAX_TIME_BLOCK_UNTIL_WITHDRAWALMODE < now));
    }

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
        returns (bool)
    {
        require(isInWithdrawMode(realmID), "NOT_IN_WITHDRAW_MODE");

        Realm storage realm = getRealm(realmID);
        Block storage lastBlock = realm.blocks[realm.numBlocks - 1];
        require(lastBlock.state == BlockState.FINALIZED, "PREV_BLOCK_NOT_FINALIZED");

        Account storage account = getAccount(realm, accountID);
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
        withdrawAndBurn(account.owner, tokenID, account.walletID, balance);

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
            account.walletID,
            nonce,
            balance,
            tradeHistoryRoot
        );
    }

    function withdrawFromPendingDeposit(
        uint32 realmID,
        uint depositBlockIdx,
        uint slotIdx
        )
        external
        returns (bool)
    {
        require(isInWithdrawMode(realmID), "NOT_IN_WITHDRAW_MODE");

        Realm storage realm = getRealm(realmID);
        Block storage lastBlock = realm.blocks[realm.numBlocks - 1];
        require(lastBlock.state == BlockState.FINALIZED, "PREV_BLOCK_NOT_FINALIZED");

        require (depositBlockIdx >= lastBlock.numDepositBlocksCommitted, "BLOCK_COMMITTED_ALREADY");

        require(depositBlockIdx < realm.numDepositBlocks, "INVALID_BLOCK_IDX");
        require(
            slotIdx < realm.depositBlocks[depositBlockIdx].pendingDeposits.length,
            "INVALID_SLOT_IDX"
        );

        PendingDeposit storage pendingDeposit =
            realm.depositBlocks[depositBlockIdx].pendingDeposits[slotIdx];

        uint amount = pendingDeposit.amount;
        require(amount > 0, "WITHDRAWN_ALREADY");

        // Set the amount to 0 so it cannot be withdrawn again
        pendingDeposit.amount = 0;

        // Transfer the tokens
        Account storage account = realm.accounts[pendingDeposit.accountID];
        withdrawAndBurn(account.owner, pendingDeposit.tokenID, account.walletID, amount);
    }

}
