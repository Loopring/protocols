import BN = require("bn.js");
import fs = require("fs");
import Web3 from "web3";
import { Bitstream } from "./bitstream";
import * as constants from "./constants";
import { fromFloat } from "./float";
import poseidon = require("./poseidon");
import { ProtocolV3 } from "./ProtocolV3";
import { SparseMerkleTree } from "./SparseMerkleTree";
import {BlockType, BlockState, ForgeMode, Block, Deposit, OnchainWithdrawal, Trade, OffchainWithdrawal,
        OrderCancellation, TradeHistory, Token, Balance, Account, WithdrawFromMerkleTreeData} from "./types";

interface SettlementValues {
  fillSA: BN;
  fillBA: BN;
  feeA: BN;
  protocolFeeA: BN;
  rebateA: BN;

  fillSB: BN;
  fillBB: BN;
  feeB: BN;
  protocolFeeB: BN;
  rebateB: BN;
}

interface Range {
  offset: number;
  length: number;
}

export class ExchangeV3 {
  private web3: Web3;

  private exchangeV3Abi: string;
  private commitBlockFunctionSignature: string;

  private exchangeAddress: string;
  private exchangeId: number;
  private exchange: any;
  private onchainDataAvailability: boolean;
  private forgeMode: ForgeMode;
  private protocol: ProtocolV3;
  private implementation: string;
  private exchangeCreationTimestamp: number;

  private decompressorAbi: string;
  private decompressor: any;

  private syncedToEthereumBlockIdx: number;

  private owner: string;
  private operator: string;

  private shutdown: boolean;
  private inMaintenenance: boolean;
  private inWithdrawalMode: boolean;
  private totalTimeInMaintenanceSeconds: number;

  private tokens: Token[] = [];

  private blocks: Block[] = [];
  private accounts: Account[] = [];

  private ownerToAccountId: { [key: string]: number } = {};

  private deposits: Deposit[] = [];
  private onchainWithdrawals: OnchainWithdrawal[] = [];

  private processedRequests: any[] = [];
  private numBlocksFinalized: number;

  private hasher: any;
  private merkleTree: SparseMerkleTree;

  private genesisMerkleRoot = "19576940549163814464655809526001218205804522676808413160044023933932119144961";

  public async initialize(web3: Web3, exchangeAddress: string, exchangeId: number, owner: string,
                          onchainDataAvailability: boolean, forgeMode: ForgeMode, protocol: ProtocolV3, implementation: string) {
    this.web3 = web3;
    this.exchangeAddress = exchangeAddress;
    this.exchangeId = exchangeId;
    this.owner = owner;
    this.operator = owner;
    this.onchainDataAvailability = onchainDataAvailability;
    this.forgeMode = forgeMode;
    this.protocol = protocol;
    this.implementation = implementation;

    this.syncedToEthereumBlockIdx = 0;

    const ABIPath = "ABI/version30/";
    this.exchangeV3Abi = fs.readFileSync(ABIPath + "IExchangeV3.abi", "ascii");
    this.decompressorAbi = fs.readFileSync(ABIPath + "IDecompressor.abi", "ascii");

    this.exchange = new web3.eth.Contract(JSON.parse(this.exchangeV3Abi));
    this.exchange.options.address = this.exchangeAddress;

    this.decompressor = new web3.eth.Contract(JSON.parse(this.decompressorAbi));

    this.exchangeCreationTimestamp = await this.exchange.methods.getExchangeCreationTimestamp().call();

    this.shutdown = false;
    this.inMaintenenance = false;
    this.inWithdrawalMode = false;
    this.totalTimeInMaintenanceSeconds = 0;

    this.commitBlockFunctionSignature = "0x39d07df5";

    const genesisBlock: Block = {
      blockIdx: 0,

      blockType: BlockType.RING_SETTLEMENT,
      blockSize: 0,
      blockVersion: 0,
      data: "0x",
      offchainData: "0x",

      operator: constants.zeroAddress,

      blockState: BlockState.FINALIZED,

      merkleRoot: this.genesisMerkleRoot,

      committedTimestamp: this.exchangeCreationTimestamp,

      numRequestsProcessed: 0,
      totalNumRequestsProcessed: 0,

      totalNumTradesProccesed: 0,
      totalNumDepositsProccesed: 1,
      totalNumOnchainWithdrawalsProcessed: 1,
      totalNumOffchainWithdrawalsProcessed: 0,
      totalNumOrderCancellationsProcessed: 0,

      transactionHash: constants.zeroAddress,
    };
    this.blocks.push(genesisBlock);
    this.numBlocksFinalized = 1;

    const genesisDeposit: Deposit = {
      depositIdx: 0,

      accountID: 0,
      tokenID: 0,
      amount: new BN(0),
      publicKeyX: "0",
      publicKeyY: "0",

      transactionHash: "0x",
    };
    this.deposits.push(genesisDeposit);

    const genesisWithdrawal: OnchainWithdrawal = {
      withdrawalIdx: 0,

      accountID: 0,
      tokenID: 0,
      amount: new BN(0),

      transactionHash: "0x",
    };
    this.onchainWithdrawals.push(genesisWithdrawal);

    const protocolPoolAccount: Account = {
      accountId: 0,
      owner: constants.zeroAddress,

      publicKeyX: "0",
      publicKeyY: "0",
      nonce: 0,
      balances: {},
    };
    this.accounts.push(protocolPoolAccount);
  }

  public async sync(ethereumBlockTo: number) {
    if (ethereumBlockTo <= this.syncedToEthereumBlockIdx) {
      return;
    }

    const events = await this.exchange.getPastEvents("allEvents", {fromBlock: this.syncedToEthereumBlockIdx, toBlock: ethereumBlockTo});
    for (const event of events) {
      //console.log(event.event);
      if (event.event === "BlockCommitted") {
        const block = await this.processBlockCommitted(event);
        await this.processBlock(block);
      } else if (event.event === "AccountCreated") {
        await this.processAccountCreated(event);
      } else if (event.event === "DepositRequested") {
        await this.processDepositRequested(event);
      } else if (event.event === "WithdrawalRequested") {
        await this.processWithdrawalRequested(event);
      } else if (event.event === "TokenRegistered") {
        await this.processTokenRegistered(event);
      } else if (event.event === "BlockVerified") {
        await this.processBlockVerified(event);
      } else if (event.event === "BlockFinalized") {
        await this.processBlockFinalized(event);
      } else if (event.event === "Shutdown") {
        await this.processShutdown(event);
      } else if (event.event === "OperatorChanged") {
        await this.processOperatorChanged(event);
      } else if (event.event === "Revert") {
        await this.processRevert(event);
      } else if (event.event === "OwnershipTransferred") {
        await this.processOwnershipTransferred(event);
      }
    }

    // Get some values directly from the smart contract because we cannot depend on events
    // (we can go automatically out of maintenance mode and automitically into withdrawal mode)
    this.inMaintenenance = await this.exchange.methods.isInMaintenance().call();
    this.inWithdrawalMode = await this.exchange.methods.isInWithdrawalMode().call();
    this.totalTimeInMaintenanceSeconds = await this.exchange.methods.getTotalTimeInMaintenanceSeconds().call();

    //this.buildMerkleTree();
    //for (let i = 0; i < this.accounts.length; i++) {
    //  const proof = this.merkleTree.createProof(i);
    //  console.log("- " + i);
    //  console.log(proof);
    //}

    this.syncedToEthereumBlockIdx = ethereumBlockTo;
  }

  // This builds the Merkle tree on the current state from scratch
  public buildMerkleTree() {
    this.hasher = poseidon.createHash(5, 6, 52);

    const tradeHistoryMerkleTree = new SparseMerkleTree(7);
    tradeHistoryMerkleTree.newTree(this.hasher([0, 0, 0]).toString(10));
    const balancesMerkleTree = new SparseMerkleTree(4);
    balancesMerkleTree.newTree(this.hasher([0, tradeHistoryMerkleTree.getRoot()]).toString(10));
    this.merkleTree = new SparseMerkleTree(10);
    this.merkleTree.newTree(this.hasher([0, 0, 0, balancesMerkleTree.getRoot()]).toString(10));

    for (const account of this.accounts) {
      account.balancesMerkleTree = new SparseMerkleTree(4);
      account.balancesMerkleTree.newTree(this.hasher([0, tradeHistoryMerkleTree.getRoot()]).toString(10));
      for (const tokenID of Object.keys(account.balances)) {
        const balanceValue = account.balances[Number(tokenID)];
        balanceValue.tradeHistoryTree = new SparseMerkleTree(7);
        balanceValue.tradeHistoryTree.newTree(this.hasher([0, 0, 0]).toString(10));
        for (const orderID of Object.keys(balanceValue.tradeHistory)) {
          const tradeHistoryValue = balanceValue.tradeHistory[Number(orderID)];
          balanceValue.tradeHistoryTree.update(Number(orderID), this.hasher([tradeHistoryValue.filled, tradeHistoryValue.cancelled, tradeHistoryValue.orderID]).toString(10));
        }
        account.balancesMerkleTree.update(Number(tokenID), this.hasher([balanceValue.balance, balanceValue.tradeHistoryTree.getRoot()]).toString(10));
      }
      this.merkleTree.update(account.accountId, this.hasher([account.publicKeyX, account.publicKeyY, account.nonce, account.balancesMerkleTree.getRoot()]).toString(10));
    }
    // console.log("Merkle root: " + this.merkleTree.getRoot());
  }

  public getWithdrawFromMerkleTreeData(accountID: number, tokenID: number) {
    assert(accountID < this.accounts.length, "invalid account ID");
    assert(tokenID < this.tokens.length, "invalid token ID");

    const account = this.accounts[accountID];
    const accountMerkleProof = this.merkleTree.createProof(accountID);
    const balanceMerkleProof = account.balancesMerkleTree.createProof(accountID);

    const withdrawFromMerkleTreeData: WithdrawFromMerkleTreeData = {
      owner: account.owner,
      token: this.tokens[tokenID].address,
      publicKeyX: account.publicKeyX,
      publicKeyY: account.publicKeyY,
      nonce: account.nonce,
      balance: account.balances[tokenID].balance,
      tradeHistoryRoot: account.balances[tokenID].tradeHistoryTree.getRoot(),
      accountMerkleProof,
      balanceMerkleProof,
    };
    return withdrawFromMerkleTreeData;
  }

  /// Blocks

  public getNumBlocks() {
    return this.blocks.length;
  }

  public getBlock(blockIdx: number) {
    return this.blocks[blockIdx];
  }

  public getNumBlocksFinalized() {
    return this.numBlocksFinalized;
  }

  /// Tokens

  public getNumTokens() {
    return this.tokens.length;
  }

  public getToken(tokenID: number) {
    return this.tokens[tokenID];
  }

  /// Accounts

  public getNumAccounts() {
    return this.accounts.length;
  }

  public getAccount(accountId: number) {
    return this.accounts[accountId];
  }

  public getAccountByOwner(owner: string) {
    return this.accounts[this.getAccountId(owner)];
  }

  public getAccountId(owner: string) {
    return this.ownerToAccountId[owner];
  }

  /// Processed requests

  public getNumProcessedRequests() {
    return this.processedRequests.length;
  }

  public getProcessedRequest(requestIdx: number) {
    return this.processedRequests[requestIdx];
  }

  public getProcessedRequests(startIdx: number, count: number) {
    const requests: any[] = [];
    if (startIdx >= this.processedRequests.length) {
      return [];
    }
    const endIdx = Math.min(startIdx + count, this.processedRequests.length);
    for (let i = startIdx; i < endIdx; i++) {
      requests.push(this.getProcessedRequest(i));
    }
    return requests;
  }

  public getRequestsInBlock(blockIdx: number) {
    if(blockIdx === 0 || blockIdx >= this.blocks.length) {
      return [];
    }
    const block = this.getBlock(blockIdx);
    return this.getProcessedRequests(block.totalNumRequestsProcessed - block.numRequestsProcessed, block.numRequestsProcessed);
  }

  /// Deposits

  public getNumDeposits() {
    return this.deposits.length;
  }

  public getDeposit(depositIdx: number) {
    return this.deposits[depositIdx];
  }

  public getDeposits(startIdx: number, count: number) {
    const deposits: Deposit[] = [];
    if (startIdx >= this.deposits.length) {
      return [];
    }
    const endIdx = Math.min(startIdx + count, this.deposits.length);
    for (let i = startIdx; i < endIdx; i++) {
      deposits.push(this.getDeposit(i));
    }
    return deposits;
  }

  /// On-chain withdrawals

  public getNumOnchainWithdrawalRequests() {
    return this.onchainWithdrawals.length;
  }

  public getOnchainWithdrawalRequest(withdrawalIdx: number) {
    return this.onchainWithdrawals[withdrawalIdx];
  }

  public getOnchainWithdrawalRequests(startIdx: number, count: number) {
    const withdrawals: OnchainWithdrawal[] = [];
    if (startIdx >= this.onchainWithdrawals.length) {
      return [];
    }
    const endIdx = Math.min(startIdx + count, this.onchainWithdrawals.length);
    for (let i = startIdx; i < endIdx; i++) {
      withdrawals.push(this.getOnchainWithdrawalRequest(i));
    }
    return withdrawals;
  }

  /// Meta

  public getExchangeId() {
    return this.exchangeId;
  }

  public getAddress() {
    return this.exchangeAddress;
  }

  public getOwner() {
    return this.owner;
  }

  public getOperator() {
    return this.operator;
  }

   public hasOnchainDataAvailability() {
    return this.onchainDataAvailability;
  }

  public getForgeMode() {
    return this.forgeMode;
  }

  public getProtocol() {
    return this.protocol;
  }

  public getImplementation() {
    return this.implementation;
  }

  public getExchangeCreationTimestamp() {
    return this.exchangeCreationTimestamp;
  }

  public getExchangeStake() {
    return this.protocol.getExchangeStake(this.exchangeId);
  }

  public getProtocolFeeStake() {
    return this.protocol.getProtocolFeeStake(this.exchangeId);
  }

  public isInMaintenenance() {
    return this.inMaintenenance;
  }

  public isInWithdrawalMode() {
    return this.inWithdrawalMode;
  }

  public getTotalTimeInMaintenanceSeconds() {
    return this.totalTimeInMaintenanceSeconds;
  }

  /// Private

  private async processBlockCommitted(event: any) {
    const transaction = await this.web3.eth.getTransaction(event.transactionHash);
    if (transaction.input.startsWith(this.commitBlockFunctionSignature)) {
      // Get the timestamp from the block
      const ethereumBlock = await this.web3.eth.getBlock(event.blockNumber);
      const committedTimestamp = ethereumBlock.timestamp;

      // Get the inputs to commitBlock
      // Note: this will not work if an operator contract is used with a different function signature
      const decodedInputs = this.web3.eth.abi.decodeParameters(["uint8", "uint16", "uint8", "bytes", "bytes"], "0x" + transaction.input.slice(2 + 4*2));

      // Get the block data
      let data: string;
      if (decodedInputs[3].startsWith("0x00")) {
        data = "0x" + decodedInputs[3].slice(4);
      } else if (decodedInputs[3].startsWith("0x01")) {
        // Decompress using the decompressor contract
        // We assume here that the decompressor contract is static, as in it always behaves the same no matter when it is called
        const decompressorAddress = "0x" + decodedInputs[3].slice(4, 4 + 40);
        const compressedData = "0x" + decodedInputs[3].slice(4 + 40);
        this.decompressor.options.address = decompressorAddress;
        data = await this.decompressor.methods.decompress(this.web3.utils.hexToBytes(compressedData)).call();
      } else {
        assert(false, "unsupported data compression mode");
      }

      // Get the new Merkle root
      const bs = new Bitstream(data);
      const merkleRoot = bs.extractUint(4 + 32).toString(10);
      // console.log("merkleRoot: " + merkleRoot);

      // Make sure the blocks are in the right order
      assert.equal(this.blocks.length, parseInt(event.returnValues.blockIdx), "Unexpected blockIdx");

      // Create the block
      const lastBlock = this.blocks[this.blocks.length - 1];
      const newBlock: Block = {
        blockIdx: this.blocks.length,

        blockType: parseInt(decodedInputs[0]),
        blockSize: parseInt(decodedInputs[1]),
        blockVersion: parseInt(decodedInputs[2]),
        data,
        offchainData: decodedInputs[3],

        operator: transaction.from,

        blockState: BlockState.COMMITTED,

        merkleRoot,

        committedTimestamp,

        numRequestsProcessed: 0,
        totalNumRequestsProcessed: lastBlock.totalNumRequestsProcessed,

        totalNumTradesProccesed: lastBlock.totalNumTradesProccesed,
        totalNumDepositsProccesed: lastBlock.totalNumDepositsProccesed,
        totalNumOnchainWithdrawalsProcessed: lastBlock.totalNumOnchainWithdrawalsProcessed,
        totalNumOffchainWithdrawalsProcessed: lastBlock.totalNumOffchainWithdrawalsProcessed,
        totalNumOrderCancellationsProcessed: lastBlock.totalNumOrderCancellationsProcessed,

        transactionHash: event.transactionHash,
      };
      this.blocks.push(newBlock);
      return newBlock;
    }
    return undefined;
  }

  private async processAccountCreated(event: any) {
    // Make sure the accounts are in the right order
    assert.equal(this.accounts.length, parseInt(event.returnValues.id), "Unexpected account ID");

    const newAccount: Account = {
      accountId: parseInt(event.returnValues.id),
      owner: event.returnValues.owner,

      publicKeyX: event.returnValues.pubKeyX,
      publicKeyY: event.returnValues.pubKeyY,
      nonce: 0,
      balances: {},
    };
    this.accounts.push(newAccount);
    this.ownerToAccountId[newAccount.owner] = newAccount.accountId;
  }

  private async processDepositRequested(event: any) {
    // Make sure the deposits are in the right order
    assert.equal(this.deposits.length, parseInt(event.returnValues.depositIdx), "Unexpected depositIdx");

    const deposit: Deposit = {
      depositIdx: parseInt(event.returnValues.depositIdx),

      accountID: parseInt(event.returnValues.accountID),
      tokenID: parseInt(event.returnValues.tokenID),
      amount: new BN(event.returnValues.amount, 10),
      publicKeyX: event.returnValues.pubKeyX,
      publicKeyY: event.returnValues.pubKeyY,

      transactionHash: event.transactionHash,
    };
    this.deposits.push(deposit);
  }

  private async processWithdrawalRequested(event: any) {
    // Make sure the onchain withdrawals are in the right order
    assert.equal(this.onchainWithdrawals.length, parseInt(event.returnValues.withdrawalIdx), "Unexpected withdrawalIdx");

    const onchainWithdrawal: OnchainWithdrawal = {
      withdrawalIdx: parseInt(event.returnValues.withdrawalIdx),

      accountID: parseInt(event.returnValues.accountID),
      tokenID: parseInt(event.returnValues.tokenID),
      amount: new BN(event.returnValues.amount, 10),

      transactionHash: event.transactionHash,
    };
    this.onchainWithdrawals.push(onchainWithdrawal);
  }

  private async processTokenRegistered(event: any) {
    // Make sure the tokens are in the right order
    assert.equal(this.tokens.length, parseInt(event.returnValues.tokenId), "Unexpected tokenId");
    const token: Token = {
        tokenID: this.tokens.length,
        address: event.returnValues.token,
        enabled: true,
    };
    this.tokens.push(token);
  }

  private async processBlockVerified(event: any) {
    const blockIdx = parseInt(event.returnValues.blockIdx);
    assert(blockIdx < this.blocks.length, "blockIdx >= this.blocks.length");

    const block = this.blocks[blockIdx];
    // Make sure the block is in the expected state
    assert.equal(block.blockState, BlockState.COMMITTED, "Unexpected block state");
    block.blockState = BlockState.VERIFIED;

    // Get the timestamp from the block
    const ethereumBlock = await this.web3.eth.getBlock(event.blockNumber);
    block.verifiedTimestamp = ethereumBlock.timestamp;
  }

  private async processBlockFinalized(event: any) {
    const blockIdx = parseInt(event.returnValues.blockIdx);
    assert(blockIdx < this.blocks.length, "blockIdx >= this.blocks.length");

    const block = this.blocks[blockIdx];
    // Make sure the block is in the expected state
    assert.equal(block.blockState, BlockState.VERIFIED, "Unexpected block state");
    block.blockState = BlockState.FINALIZED;

    // Get the timestamp from the block
    const ethereumBlock = await this.web3.eth.getBlock(event.blockNumber);
    block.finalizedTimestamp = ethereumBlock.timestamp;
    this.numBlocksFinalized++;
  }

  private async processShutdown(event: any) {
    this.shutdown = true;
  }

  private async processOperatorChanged(event: any) {
    assert(this.operator === event.returnValues.oldOperator, "unexpected operator");
    this.operator = event.returnValues.newOperator;
  }

  private async processRevert(event: any) {
    // TODO
  }

  private async processOwnershipTransferred(event: any) {
    assert(this.owner === event.returnValues.oldOwner, "unexpected owner");
    this.owner = event.returnValues.newOwner;
  }

  // Apply the block changes to the current state
  private async processBlock(block: Block) {
    if (block.blockType === BlockType.RING_SETTLEMENT) {
      this.processBlockRingSettlement(block);
    } else if (block.blockType === BlockType.DEPOSIT) {
      this.processBlockDeposit(block);
    } else if (block.blockType === BlockType.ONCHAIN_WITHDRAWAL) {
      this.processBlockOnchainWithdrawal(block);
    } else if (block.blockType === BlockType.OFFCHAIN_WITHDRAWAL) {
      this.processBlockOffchainWithdrawal(block);
    } else if (block.blockType === BlockType.ORDER_CANCELLATION) {
      this.processBlockOrderCancellation(block);
    } else {
      assert(false, "Unknown block type");
    }
  }

  /// Deposits

  private processBlockDeposit(block: Block) {
    const offset = 4 + 32 + 32 + 32 + 32;
    const data = new Bitstream(block.data);
    const startIdx = data.extractUint32(offset);
    const length = data.extractUint32(offset + 4);
    //console.log("startIdx: " + startIdx);
    //console.log("length: " + length);
    for (let i = startIdx; i < startIdx + length; i++) {
      const deposit = this.deposits[i];

      assert(deposit.accountID < this.accounts.length, "accountID invalid");
      const account = this.accounts[deposit.accountID];
      account.balances[deposit.tokenID] = account.balances[deposit.tokenID] || { balance: new BN(0), tradeHistory: {} };

      account.balances[deposit.tokenID].balance = account.balances[deposit.tokenID].balance.add(deposit.amount);
      if (account.balances[deposit.tokenID].balance.gt(constants.MAX_AMOUNT)) {
        account.balances[deposit.tokenID].balance = constants.MAX_AMOUNT;
      }
      account.publicKeyX = deposit.publicKeyX;
      account.publicKeyY = deposit.publicKeyY;

      deposit.blockIdx = block.blockIdx;
      deposit.requestIdx = this.processedRequests.length;
      this.processedRequests.push(deposit);
    }

    block.numRequestsProcessed = length;
    block.totalNumRequestsProcessed += length;
    block.totalNumDepositsProccesed += length;
  }

  /// Onchain withdrawals

  private processBlockOnchainWithdrawal(block: Block) {
    let offset = 4 + 32 + 32 + 32 + 32;
    const data = new Bitstream(block.data);
    const startIdx = data.extractUint32(offset);
    offset += 4;
    const length = data.extractUint32(offset);
    offset += 4;
    //console.log("startIdx: " + startIdx);
    //console.log("length: " + length);
    for (let i = 0; i < length; i++) {
      const approvedWitdrawal = data.extractUint56(offset + i * 7);

      const tokenID = Math.floor(approvedWitdrawal / 2 ** 48) & 0xFF;
      const accountID = Math.floor(approvedWitdrawal / 2 ** 28) & 0xFFFFF;
      const amount = fromFloat(approvedWitdrawal & 0xFFFFFFF, constants.Float28Encoding);

      // When a withdrawal is done before the deposit (account creation) we shouldn't
      // do anything. Just leave everything as it is.
      if (accountID < this.accounts.length) {
        const account = this.accounts[accountID];
        account.balances[tokenID] = account.balances[tokenID] || { balance: new BN(0), tradeHistory: {} };

        const balance = account.balances[tokenID].balance;
        const amountToSubtract = this.shutdown ? balance : amount;

        // Update balance
        account.balances[tokenID].balance = account.balances[tokenID].balance.sub(amountToSubtract);

        if (this.shutdown) {
          account.publicKeyX = "0";
          account.publicKeyY = "0";
          account.nonce = 0;
          account.balances[tokenID].tradeHistory = {};
        } else {
          const onchainWithdrawal = this.onchainWithdrawals[startIdx + i];
          onchainWithdrawal.blockIdx = block.blockIdx;
          onchainWithdrawal.requestIdx = this.processedRequests.length;
          this.processedRequests.push(onchainWithdrawal);
        }
      }
    }

    block.numRequestsProcessed = length;
    block.totalNumRequestsProcessed += length;
    block.totalNumOnchainWithdrawalsProcessed += length;
  }

  /// Offchain withdrawals

  private processBlockOffchainWithdrawal(block: Block) {
    const data = new Bitstream(block.data);

    const approvedWithdrawalOffset = 4 + 32 + 32;

    let daOffset = approvedWithdrawalOffset + block.blockSize * 7 + 32;
    const operatorAccountID = data.extractUint24(daOffset);
    daOffset += 3;

    for (let i = 0; i < block.blockSize; i++) {
      const approvedWitdrawal = data.extractUint56(approvedWithdrawalOffset + i * 7);

      const tokenID = Math.floor(approvedWitdrawal / 2 ** 48) & 0xFF;
      const accountID = Math.floor(approvedWitdrawal / 2 ** 28) & 0xFFFFF;
      const amount = fromFloat(approvedWitdrawal & 0xFFFFFFF, constants.Float28Encoding);

      const feeTokenID = data.extractUint8(daOffset + i * 3);
      const fee = fromFloat(data.extractUint16(daOffset + i * 3 + 1), constants.Float16Encoding);

      const account = this.accounts[accountID];
      account.balances[tokenID] = account.balances[tokenID] || { balance: new BN(0), tradeHistory: {} };
      account.balances[feeTokenID] = account.balances[feeTokenID] || { balance: new BN(0), tradeHistory: {} };

      // Update balanceF
      account.balances[feeTokenID].balance = account.balances[feeTokenID].balance.sub(fee);

      // Update balance
      account.balances[tokenID].balance = account.balances[tokenID].balance.sub(amount);
      account.nonce++;

      // Update operator
      const operator = this.accounts[operatorAccountID];
      operator.balances[feeTokenID] = operator.balances[feeTokenID] || { balance: new BN(0), tradeHistory: {} };
      operator.balances[feeTokenID].balance = operator.balances[feeTokenID].balance.add(fee);

      const offchainWithdrawal: OffchainWithdrawal = {
        requestIdx: this.processedRequests.length,
        blockIdx: block.blockIdx,
        accountID,
        tokenID,
        amount,
        feeTokenID,
        fee,
      };
      this.processedRequests.push(offchainWithdrawal);
    }

    block.numRequestsProcessed = block.blockSize;
    block.totalNumRequestsProcessed += block.blockSize;
    block.totalNumOffchainWithdrawalsProcessed += block.blockSize;
  }

  // Order cancellations

  private processBlockOrderCancellation(block: Block) {
    const data = new Bitstream(block.data);

    let offset = 4 + 32 + 32 + 32;

    // General data
    const operatorAccountID = data.extractUint24(offset);
    offset += 3;

    // Jump to the specified withdrawal
    const onchainDataSize = 9;

    const startOffset = offset;
    for (let i = 0; i < block.blockSize; i++) {
      offset = startOffset + i * onchainDataSize;

      // Extract onchain data
      const accountIdAndOrderId = data.extractUint40(offset);
      offset += 5;
      const orderTokenID = data.extractUint8(offset);
      offset += 1;
      const feeTokenID = data.extractUint8(offset);
      offset += 1;
      const fFee = data.extractUint16(offset);
      offset += 2;

      // Further extraction of packed data
      const accountID = Math.floor(accountIdAndOrderId / 2 ** 20);
      const orderID = accountIdAndOrderId & 0xfffff;

      // Decode the float values
      const fee = fromFloat(fFee, constants.Float16Encoding);

      // Update the Merkle tree with the onchain data
      this.cancelOrder(
        operatorAccountID,
        accountID,
        orderTokenID,
        orderID,
        feeTokenID,
        fee,
      );

      const orderCancellation: OrderCancellation = {
        requestIdx: this.processedRequests.length,
        blockIdx: block.blockIdx,
        accountID,
        orderTokenID,
        orderID,
        feeTokenID,
        fee,
      };
      this.processedRequests.push(orderCancellation);
    }

    block.numRequestsProcessed = block.blockSize;
    block.totalNumRequestsProcessed += block.blockSize;
    block.totalNumOrderCancellationsProcessed += block.blockSize;
  }

  private cancelOrder(
    operatorAccountID: number,
    accountID: number,
    orderTokenID: number,
    orderID: number,
    feeTokenID: number,
    fee: BN
  ) {
    const account = this.accounts[accountID];
    account.balances[orderTokenID] = account.balances[orderTokenID] || { balance: new BN(0), tradeHistory: {} };
    account.balances[feeTokenID] = account.balances[feeTokenID] || { balance: new BN(0), tradeHistory: {} };

    const tradeHistorySlot = orderID % 2 ** constants.TREE_DEPTH_TRADING_HISTORY;

    // Update balance
    account.balances[feeTokenID].balance = account.balances[feeTokenID].balance.sub(fee);
    account.nonce++;

    // Update trade history
    account.balances[orderTokenID].tradeHistory[tradeHistorySlot] = account.balances[orderTokenID].tradeHistory[tradeHistorySlot] || {filled: new BN(0), cancelled: false, orderID: 0};
    const tradeHistory = account.balances[orderTokenID].tradeHistory[tradeHistorySlot];
    if (tradeHistory.orderID < orderID) {
      tradeHistory.filled = new BN(0);
    }
    tradeHistory.cancelled = true;
    tradeHistory.orderID = orderID;

    // Update operator
    const operator = this.accounts[operatorAccountID];
    operator.balances[feeTokenID] = operator.balances[feeTokenID] || { balance: new BN(0), tradeHistory: {} };
    operator.balances[feeTokenID].balance = operator.balances[feeTokenID].balance.add(fee);
  }

  // Rings settlements

  private processBlockRingSettlement(block: Block) {
    let data: Bitstream;
    if (this.onchainDataAvailability) {
      // Reverse circuit transform
      const ringDataStart = 4 + 32 + 32 + 4 + 1 + 1 + 32 + 3;
      const ringData = this.inverseTransformRingSettlementsData(
        "0x" + block.data.slice(2 + 2 * ringDataStart)
      );
      data = new Bitstream(
        block.data.slice(0, 2 + 2 * ringDataStart) + ringData.slice(2)
      );
    } else {
      data = new Bitstream(block.data);
    }

    let offset = 0;

    // General data
    offset += 4 + 32 + 32 + 4;
    const protocolFeeTakerBips = data.extractUint8(offset);
    offset += 1;
    const protocolFeeMakerBips = data.extractUint8(offset);
    offset += 1;
    // LabelHash
    offset += 32;
    const operatorAccountID = data.extractUint24(offset);
    offset += 3;

    for (let i = 0; i < block.blockSize; i++) {
      // Jump to the specified ring
      const ringSize = 20;
      offset += i * ringSize;

      // Order IDs
      const orderIds = data.extractUint40(offset);
      offset += 5;

      // Accounts
      const accounts = data.extractUint40(offset);
      offset += 5;

      // Order A
      const tokenA = data.extractUint8(offset);
      offset += 1;
      const fFillSA = data.extractUint24(offset);
      offset += 3;
      const orderDataA = data.extractUint8(offset);
      offset += 1;

      // Order B
      const tokenB = data.extractUint8(offset);
      offset += 1;
      const fFillSB = data.extractUint24(offset);
      offset += 3;
      const orderDataB = data.extractUint8(offset);
      offset += 1;

      // Further extraction of packed data
      const orderIdA = Math.floor(orderIds / 2 ** 20);
      const orderIdB = orderIds & 0xfffff;

      const accountIdA = Math.floor(accounts / 2 ** 20);
      const accountIdB = accounts & 0xfffff;

      const buyMaskA = orderDataA & 0b10000000;
      const rebateMaskA = orderDataA & 0b01000000;
      const feeOrRebateA = orderDataA & 0b00111111;
      const buyA = buyMaskA > 0;
      const feeBipsA = rebateMaskA > 0 ? 0 : feeOrRebateA;
      const rebateBipsA = rebateMaskA > 0 ? feeOrRebateA : 0;

      const buyMaskB = orderDataB & 0b10000000;
      const rebateMaskB = orderDataB & 0b01000000;
      const feeOrRebateB = orderDataB & 0b00111111;
      const buyB = buyMaskB > 0;
      const feeBipsB = rebateMaskB > 0 ? 0 : feeOrRebateB;
      const rebateBipsB = rebateMaskB > 0 ? feeOrRebateB : 0;

      // Decode the float values
      const fillSA = fromFloat(fFillSA, constants.Float24Encoding);
      const fillSB = fromFloat(fFillSB, constants.Float24Encoding);

      // Update the state with the onchain data
      const settlementValues = this.settleRing(
        protocolFeeTakerBips,
        protocolFeeMakerBips,
        operatorAccountID,
        fillSA,
        fillSB,
        buyA,
        buyB,
        tokenA,
        tokenB,
        orderIdA,
        accountIdA,
        feeBipsA,
        rebateBipsA,
        orderIdB,
        accountIdB,
        feeBipsB,
        rebateBipsB
      );

      const trade: Trade = {
        requestIdx: this.processedRequests.length,
        blockIdx: block.blockIdx,

        accountIdA,
        fillSA: settlementValues.fillSA,
        feeA: settlementValues.feeA,
        protocolFeeA: settlementValues.protocolFeeA,
        rebateA: settlementValues.rebateA,

        accountIdB,
        fillSB: settlementValues.fillSB,
        feeB: settlementValues.feeB,
        protocolFeeB: settlementValues.protocolFeeB,
        rebateB: settlementValues.rebateB,
      };
      this.processedRequests.push(trade);
    }

    // Update operator nonce
    const operator = this.accounts[operatorAccountID];
    operator.nonce++;

    block.numRequestsProcessed = block.blockSize;
    block.totalNumRequestsProcessed += block.blockSize;
    block.totalNumTradesProccesed += block.blockSize;
  }

  private settleRing(
    protocolFeeTakerBips: number,
    protocolFeeMakerBips: number,
    operatorId: number,
    fillSA: BN,
    fillSB: BN,
    buyA: boolean,
    buyB: boolean,
    tokenA: number,
    tokenB: number,
    orderIdA: number,
    accountIdA: number,
    feeBipsA: number,
    rebateBipsA: number,
    orderIdB: number,
    accountIdB: number,
    feeBipsB: number,
    rebateBipsB: number
  ) {
    const s = this.calculateSettlementValues(
      protocolFeeTakerBips,
      protocolFeeMakerBips,
      fillSA,
      fillSB,
      feeBipsA,
      feeBipsB,
      rebateBipsA,
      rebateBipsB
    );

    // Update accountA
    const accountA = this.accounts[accountIdA];
    accountA.balances[tokenA] = accountA.balances[tokenA] || { balance: new BN(0), tradeHistory: {} };
    accountA.balances[tokenB] = accountA.balances[tokenB] || { balance: new BN(0), tradeHistory: {} };

    accountA.balances[tokenA].balance = accountA.balances[tokenA].balance.sub(s.fillSA);
    accountA.balances[tokenB].balance = accountA.balances[tokenB].balance.add(s.fillBA.sub(s.feeA).add(s.rebateA));

    // Update accountB
    const accountB = this.accounts[accountIdB];
    accountB.balances[tokenB] = accountB.balances[tokenB] || { balance: new BN(0), tradeHistory: {} };
    accountB.balances[tokenA] = accountB.balances[tokenA] || { balance: new BN(0), tradeHistory: {} };

    accountB.balances[tokenB].balance = accountB.balances[tokenB].balance.sub(s.fillSB);
    accountB.balances[tokenA].balance = accountB.balances[tokenA].balance.add(s.fillBB.sub(s.feeB).add(s.rebateB));

    // Update trade history A
    {
    const tradeHistorySlotA =
        orderIdA % 2 ** constants.TREE_DEPTH_TRADING_HISTORY;
    accountA.balances[tokenA].tradeHistory[tradeHistorySlotA] = accountA.balances[tokenA].tradeHistory[tradeHistorySlotA] || {filled: new BN(0), cancelled: false, orderID: 0};
    const tradeHistoryA =
        accountA.balances[tokenA].tradeHistory[tradeHistorySlotA];
    tradeHistoryA.filled =
        orderIdA > tradeHistoryA.orderID ? new BN(0) : tradeHistoryA.filled;
    tradeHistoryA.filled = tradeHistoryA.filled.add(
        buyA ? s.fillBA : s.fillSA
    );
    tradeHistoryA.cancelled =
        orderIdA > tradeHistoryA.orderID ? false : tradeHistoryA.cancelled;
    tradeHistoryA.orderID =
        orderIdA > tradeHistoryA.orderID ? orderIdA : tradeHistoryA.orderID;
    }
    // Update trade history B
    {
    const tradeHistorySlotB =
        orderIdB % 2 ** constants.TREE_DEPTH_TRADING_HISTORY;
    accountB.balances[tokenB].tradeHistory[tradeHistorySlotB] = accountB.balances[tokenB].tradeHistory[tradeHistorySlotB] || {filled: new BN(0), cancelled: false, orderID: 0};
    const tradeHistoryB =
        accountB.balances[tokenB].tradeHistory[tradeHistorySlotB];
    tradeHistoryB.filled =
        orderIdB > tradeHistoryB.orderID ? new BN(0) : tradeHistoryB.filled;
    tradeHistoryB.filled = tradeHistoryB.filled.add(
        buyB ? s.fillBB : s.fillSB
    );
    tradeHistoryB.cancelled =
        orderIdB > tradeHistoryB.orderID ? false : tradeHistoryB.cancelled;
    tradeHistoryB.orderID =
        orderIdB > tradeHistoryB.orderID ? orderIdB : tradeHistoryB.orderID;
    }

    // Update protocol fee recipient
    const protocolFeeAccount = this.accounts[0];
    protocolFeeAccount.balances[tokenB] = protocolFeeAccount.balances[tokenB] || { balance: new BN(0), tradeHistory: {} };
    protocolFeeAccount.balances[tokenA] = protocolFeeAccount.balances[tokenA] || { balance: new BN(0), tradeHistory: {} };
    // - Order A
    protocolFeeAccount.balances[tokenB].balance = protocolFeeAccount.balances[tokenB].balance.add(s.protocolFeeA);
    // - Order B
    protocolFeeAccount.balances[tokenA].balance = protocolFeeAccount.balances[tokenA].balance.add(s.protocolFeeB);

    // Update operator
    const operator = this.accounts[operatorId];
    operator.balances[tokenB] = operator.balances[tokenB] || { balance: new BN(0), tradeHistory: {} };
    operator.balances[tokenA] = operator.balances[tokenA] || { balance: new BN(0), tradeHistory: {} };
    // - FeeA
    operator.balances[tokenB].balance = operator.balances[tokenB].balance
    .add(s.feeA)
    .sub(s.protocolFeeA)
    .sub(s.rebateA);
    // - FeeB
    operator.balances[tokenA].balance = operator.balances[tokenA].balance
    .add(s.feeB)
    .sub(s.protocolFeeB)
    .sub(s.rebateB);

    return s;
  }

  public calculateSettlementValues(
    protocolFeeTakerBips: number,
    protocolFeeMakerBips: number,
    fillSA: BN,
    fillSB: BN,
    feeBipsA: number,
    feeBipsB: number,
    rebateBipsA: number,
    rebateBipsB: number
  ) {
    const fillBA = fillSB;
    const fillBB = fillSA;
    const [feeA, protocolFeeA, rebateA] = this.calculateFees(
      fillBA,
      protocolFeeTakerBips,
      feeBipsA,
      rebateBipsA
    );

    const [feeB, protocolFeeB, rebateB] = this.calculateFees(
      fillBB,
      protocolFeeMakerBips,
      feeBipsB,
      rebateBipsB
    );

    const settlementValues: SettlementValues = {
      fillSA,
      fillBA,
      feeA,
      protocolFeeA,
      rebateA,

      fillSB,
      fillBB,
      feeB,
      protocolFeeB,
      rebateB
    };
    return settlementValues;
  }

  private calculateFees(
    fillB: BN,
    protocolFeeBips: number,
    feeBips: number,
    rebateBips: number
  ) {
    const protocolFee = fillB.mul(new BN(protocolFeeBips)).div(new BN(100000));
    const fee = fillB.mul(new BN(feeBips)).div(new BN(10000));
    const rebate = fillB.mul(new BN(rebateBips)).div(new BN(10000));
    return [fee, protocolFee, rebate];
  }

  private inverseTransformRingSettlementsData(input: string) {
    // Inverse Transform
    const transformed = new Bitstream(input);
    const ringSize = 20;
    const numRings = transformed.length() / ringSize;
    const ranges = this.getRingTransformations();
    const compressed = new Bitstream();
    for (let r = 0; r < numRings; r++) {
      let offset = 0;
      let ringData = "00".repeat(ringSize);
      for (const subranges of ranges) {
        let totalRangeLength = 0;
        for (const subrange of subranges) {
          totalRangeLength += subrange.length;
        }
        let partialRangeLength = 0;
        for (const subrange of subranges) {
          const dataPart = transformed.extractData(offset + totalRangeLength * r + partialRangeLength, subrange.length);
          ringData = this.replaceAt(ringData, subrange.offset * 2, dataPart);
          partialRangeLength += subrange.length;
        }
        offset += totalRangeLength * numRings;
      }
      compressed.addHex(ringData);
    }
    return compressed.getData();
  }

  private getRingTransformations() {
    const ranges: Range[][] = [];
    ranges.push([{ offset: 0, length: 5 }]); // orderA.orderID + orderB.orderID
    ranges.push([{ offset: 5, length: 5 }]); // orderA.accountID + orderB.accountID
    ranges.push([{ offset: 10, length: 1 }, { offset: 15, length: 1 }]); // orderA.tokenS + orderB.tokenS
    ranges.push([{ offset: 11, length: 3 }, { offset: 16, length: 3 }]); // orderA.fillS + orderB.fillS
    ranges.push([{ offset: 14, length: 1 }]); // orderA.data
    ranges.push([{ offset: 19, length: 1 }]); // orderB.data
    return ranges;
  }

  private replaceAt(data: string, index: number, replacement: string) {
    return (data.substr(0, index) + replacement + data.substr(index + replacement.length));
  }
}