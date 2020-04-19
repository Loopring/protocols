import BN from "bn.js";
const fs = require("fs");
import Web3 from "web3";
import { Bitstream } from "./bitstream";
import { Constants } from "./constants";
const poseidon = require("./poseidon");
import { ProtocolV3 } from "./protocol_v3";
import { SparseMerkleTree } from "./sparse_merkle_tree";
import {
  BlockType,
  ForgeMode,
  Block,
  Deposit,
  OnchainWithdrawal,
  TradeHistory,
  Token,
  Balance,
  Account,
  WithdrawFromMerkleTreeData,
  ExchangeState,
  ExchangeFees,
  ProtocolFees
} from "./types";
import { DepositProcessor } from "./request_processors/deposit_processor";
import { OnchainWithdrawalProcessor } from "./request_processors/onchain_withdrawal_processor";
import { RingSettlementProcessor } from "./request_processors/ring_settlement_processor";
import { OffchainWithdrawalProcessor } from "./request_processors/offchain_withdrawal_processor";
import { InternalTransferProcessor } from "./request_processors/internal_transfer_processor";
import * as log from "./logs";

interface Revert {
  blockIdx: number;
  numBlocks: number;
}

/**
 * Processes all data of an Exchange v3 exchange contract.
 */
export class ExchangeV3 {
  private web3: Web3;

  private exchangeV3Abi: string;
  private exchangeAddress: string;
  private exchange: any;
  private forgeMode: ForgeMode;
  private protocol: ProtocolV3;
  private implementationAddress: string;
  private exchangeCreationTimestamp: number;

  private decompressorAbi: string;
  private decompressor: any;

  private syncedToEthereumBlockIdx: number;

  private owner: string;
  private operator: string;

  private shutdown: boolean;
  private shutdownStartTime: number;
  private inMaintenenance: boolean;
  private inWithdrawalMode: boolean;
  private totalTimeInMaintenanceSeconds: number;

  private tokens: Token[] = [];

  private state: ExchangeState;

  private blocks: Block[] = [];

  private numBlocksFinalized: number;

  private hasher: any;
  private merkleTree: SparseMerkleTree;

  private genesisMerkleRoot =
    "8757237825509983996127596712662861212414230359567743441818940291589472626661";

  private exchangeFees: ExchangeFees;
  private protocolFees: ProtocolFees;

  /**
   * Initializes an Exchange
   * @param   web3                      The web3 instance that will be used to get the necessary data from Ethereum
   * @param   exchangeAddress           The address of the exchange
   * @param   exchangeId                The exchange ID
   * @param   owner                     The owner of the exchange
   * @param   onchainDataAvailability   The availability of on-chain data
   * @param   forgeMode                 The forge mode the exchange was created with
   * @param   protocol                  The protocol of the exchange
   * @param   implementationAddress     The address of the implementation
   */
  public async initialize(
    web3: Web3,
    exchangeAddress: string,
    exchangeId: number,
    owner: string,
    onchainDataAvailability: boolean,
    forgeMode: ForgeMode,
    protocol: ProtocolV3,
    implementationAddress: string
  ) {
    this.web3 = web3;
    this.exchangeAddress = exchangeAddress;
    this.owner = owner;
    this.operator = owner;
    this.forgeMode = forgeMode;
    this.protocol = protocol;
    this.implementationAddress = implementationAddress;

    this.syncedToEthereumBlockIdx = 0;

    const ABIPath = "ABI/version30/";
    this.exchangeV3Abi = fs.readFileSync(ABIPath + "IExchangeV3.abi", "ascii");
    this.decompressorAbi = fs.readFileSync(
      ABIPath + "IDecompressor.abi",
      "ascii"
    );

    this.exchange = new web3.eth.Contract(JSON.parse(this.exchangeV3Abi));
    this.exchange.options.address = this.exchangeAddress;

    this.decompressor = new web3.eth.Contract(JSON.parse(this.decompressorAbi));

    this.exchangeCreationTimestamp = await this.exchange.methods
      .getExchangeCreationTimestamp()
      .call();

    this.shutdown = false;
    this.shutdownStartTime = 0;
    this.inMaintenenance = false;
    this.inWithdrawalMode = false;
    this.totalTimeInMaintenanceSeconds = 0;

    // Reset state
    this.state = {
      exchangeId,
      accounts: [],
      accountIdToOwner: {},
      ownerToAccountId: {},
      deposits: [],
      onchainWithdrawals: [],
      processedRequests: [],
      onchainDataAvailability
    };

    // Create the genesis block
    const genesisBlock: Block = {
      exchangeId,
      blockIdx: 0,

      blockType: BlockType.RING_SETTLEMENT,
      blockSize: 0,
      blockVersion: 0,
      data: "0x",
      offchainData: "0x",

      operator: Constants.zeroAddress,
      origin: Constants.zeroAddress,

      blockFeeRewarded: new BN(0),
      blockFeeFined: new BN(0),

      merkleRoot: this.genesisMerkleRoot,
      timestamp: this.exchangeCreationTimestamp,

      numRequestsProcessed: 0,
      totalNumRequestsProcessed: 0,

      totalNumTradesProccesed: 0,
      totalNumDepositsProccesed: 1,
      totalNumOnchainWithdrawalsProcessed: 1,
      totalNumOffchainWithdrawalsProcessed: 0,
      totalNumOrderCancellationsProcessed: 0,
      totalNumOrderInternalTransfersProcessed: 0,

      transactionHash: Constants.zeroAddress
    };
    this.blocks.push(genesisBlock);
    this.numBlocksFinalized = 1;

    // Create the genesis deposit
    const genesisDeposit: Deposit = {
      exchangeId,
      depositIdx: 0,
      timestamp: this.exchangeCreationTimestamp,

      accountID: 0,
      tokenID: 0,
      amount: new BN(0),
      publicKeyX: "0",
      publicKeyY: "0",

      transactionHash: "0x"
    };
    this.state.deposits.push(genesisDeposit);

    // Create the genesis withdrawal
    const genesisWithdrawal: OnchainWithdrawal = {
      exchangeId,
      withdrawalIdx: 0,
      timestamp: this.exchangeCreationTimestamp,

      accountID: 0,
      tokenID: 0,
      amountRequested: new BN(0),

      transactionHash: "0x"
    };
    this.state.onchainWithdrawals.push(genesisWithdrawal);

    // Intitialze the state of the Merkle tree
    this.setGenesisState();

    // Get the exchange fees from the contract
    const fees = await this.exchange.methods.getFees().call();
    this.exchangeFees = {
      exchangeId,
      accountCreationFeeETH: new BN(fees._accountCreationFeeETH, 10),
      accountUpdateFeeETH: new BN(fees._accountUpdateFeeETH, 10),
      depositFeeETH: new BN(fees._depositFeeETH, 10),
      withdrawalFeeETH: new BN(fees._withdrawalFeeETH, 10)
    };

    // Get the protocol fees from the contract
    const protocolFeeValues = await this.exchange.methods
      .getProtocolFeeValues()
      .call();
    this.protocolFees = {
      exchangeId,
      takerFeeBips: parseInt(protocolFeeValues.takerFeeBips),
      makerFeeBips: parseInt(protocolFeeValues.makerFeeBips),
      previousTakerFeeBips: parseInt(protocolFeeValues.previousTakerFeeBips),
      previousMakerFeeBips: parseInt(protocolFeeValues.previousMakerFeeBips)
    };
  }

  public async syncWithStep(ethereumBlockTo: number, step: number) {
    const fromBlock = this.syncedToEthereumBlockIdx + 1;
    for (let i = fromBlock; i < ethereumBlockTo; i += step) {
      if (i > ethereumBlockTo) {
        await this.sync(ethereumBlockTo);
      } else {
        await this.sync(i);
      }
    }
  }

  /**
   * Syncs the protocol up to (and including) the given Ethereum block index.
   * @param   ethereumBlockTo   The Ethereum block index to sync to
   */
  public async sync(ethereumBlockTo: number) {
    log.DEBUG(
      "exchange",
      this.exchangeAddress,
      " sync, fromBlock:",
      this.syncedToEthereumBlockIdx + 1,
      ", toBlock:",
      ethereumBlockTo
    );

    if (ethereumBlockTo <= this.syncedToEthereumBlockIdx) {
      return;
    }

    // Process the events
    const events = await this.exchange.getPastEvents("allEvents", {
      fromBlock: this.syncedToEthereumBlockIdx + 1,
      toBlock: ethereumBlockTo
    });
    for (const event of events) {
      if (event.event === "BlockSubmitted") {
        await this.processBlockSubmitted(event);
      } else if (event.event === "AccountCreated") {
        await this.processAccountCreated(event);
      } else if (event.event === "DepositRequested") {
        await this.processDepositRequested(event);
      } else if (event.event === "WithdrawalRequested") {
        await this.processWithdrawalRequested(event);
      } else if (event.event === "TokenRegistered") {
        await this.processTokenRegistered(event);
      } else if (event.event === "Shutdown") {
        await this.processShutdown(event);
      } else if (event.event === "OperatorChanged") {
        await this.processOperatorChanged(event);
      } else if (event.event === "BlockFeeWithdrawn") {
        await this.processBlockFeeWithdrawn(event);
      } else if (event.event === "FeesUpdated") {
        await this.processFeesUpdated(event);
      } else if (event.event === "ProtocolFeesUpdated") {
        await this.processProtocolFeesUpdated(event);
      } else if (event.event === "OwnershipTransferred") {
        await this.processOwnershipTransferred(event);
      }
    }

    // Get some values directly from the smart contract because we cannot depend on events
    // (we can go automatically out of maintenance mode and automatically into withdrawal mode)
    this.inMaintenenance = await this.exchange.methods.isInMaintenance().call();
    this.inWithdrawalMode = await this.exchange.methods
      .isInWithdrawalMode()
      .call();
    this.totalTimeInMaintenanceSeconds = await this.exchange.methods
      .getTotalTimeInMaintenanceSeconds()
      .call();

    this.syncedToEthereumBlockIdx = ethereumBlockTo;
  }

  /**
   * Builds the Merkle tree on the current state
   */
  public buildMerkleTree() {
    if (!this.state.onchainDataAvailability) {
      // We cannot build the Merkle tree without on-chain data-availability
      return;
    }
    this.hasher = poseidon.createHash(5, 6, 52);

    // Make empty trees so we have all necessary default values
    const tradeHistoryMerkleTree = new SparseMerkleTree(7);
    tradeHistoryMerkleTree.newTree(this.hasher([0, 0]).toString(10));
    const balancesMerkleTree = new SparseMerkleTree(4);
    balancesMerkleTree.newTree(
      this.hasher([0, tradeHistoryMerkleTree.getRoot()]).toString(10)
    );
    this.merkleTree = new SparseMerkleTree(12);
    this.merkleTree.newTree(
      this.hasher([0, 0, 0, balancesMerkleTree.getRoot()]).toString(10)
    );

    // Run over all account data and build the Merkle tree
    for (const account of this.state.accounts) {
      account.balancesMerkleTree = new SparseMerkleTree(4);
      account.balancesMerkleTree.newTree(
        this.hasher([0, tradeHistoryMerkleTree.getRoot()]).toString(10)
      );
      for (const tokenID of Object.keys(account.balances)) {
        const balanceValue = account.balances[Number(tokenID)];
        balanceValue.tradeHistoryTree = new SparseMerkleTree(7);
        balanceValue.tradeHistoryTree.newTree(this.hasher([0, 0]).toString(10));
        for (const orderID of Object.keys(balanceValue.tradeHistory)) {
          const tradeHistoryValue = balanceValue.tradeHistory[Number(orderID)];
          balanceValue.tradeHistoryTree.update(
            Number(orderID),
            this.hasher([
              tradeHistoryValue.filled,
              tradeHistoryValue.orderID
            ]).toString(10)
          );
        }
        account.balancesMerkleTree.update(
          Number(tokenID),
          this.hasher([
            balanceValue.balance,
            balanceValue.tradeHistoryTree.getRoot()
          ]).toString(10)
        );
      }
      this.merkleTree.update(
        account.accountId,
        this.hasher([
          account.publicKeyX,
          account.publicKeyY,
          account.nonce,
          account.balancesMerkleTree.getRoot()
        ]).toString(10)
      );
    }
    // console.log("Merkle root: " + this.merkleTree.getRoot());
    assert.equal(
      this.merkleTree.getRoot(),
      this.blocks[this.blocks.length - 1].merkleRoot,
      "Merkle tree root inconsistent"
    );
  }

  /**
   * Builds the Merkle tree on the state necessary for withdrawal mode
   * (on the state of the last finalized block).
   */
  public buildMerkleTreeForWithdrawalMode() {
    this.buildMerkleTree();
  }

  /**
   * Returns the data necessary to withdraw directly from the Merkle tree on-chain
   * (only avaible in withdrawal mode).
   * @param   accountID   The account ID of the balance to withdraw
   * @param   tokenID     The token ID of the balance to withdraw
   * @return  The necessary data for withdrawFromMerkleTree(for)
   */
  public getWithdrawFromMerkleTreeData(accountID: number, tokenID: number) {
    assert(
      this.state.onchainDataAvailability,
      "cannot create the Merkle proofs for an exchange without on-chain data-availability"
    );
    assert(accountID < this.state.accounts.length, "invalid account ID");
    assert(tokenID < this.tokens.length, "invalid token ID");

    const account = this.state.accounts[accountID];
    const accountMerkleProof = this.merkleTree.createProof(accountID);
    const balanceMerkleProof = account.balancesMerkleTree.createProof(tokenID);

    const withdrawFromMerkleTreeData: WithdrawFromMerkleTreeData = {
      owner: account.owner,
      token: this.tokens[tokenID].address,
      publicKeyX: account.publicKeyX,
      publicKeyY: account.publicKeyY,
      nonce: account.nonce,
      balance: account.balances[tokenID].balance,
      tradeHistoryRoot: account.balances[tokenID].tradeHistoryTree.getRoot(),
      accountMerkleProof,
      balanceMerkleProof
    };
    return withdrawFromMerkleTreeData;
  }

  /// Blocks

  /**
   * The total number of blocks committed on-chain
   * @return  The total number of blocks
   */
  public getNumBlocks() {
    return this.blocks.length;
  }

  /**
   * Gets the blocks using the blocks's index in the list of all blocks
   * @param   index   The index of the block
   * @return  The block on the given index
   */
  public getBlock(blockIdx: number) {
    return this.blocks[blockIdx];
  }

  /// Tokens

  /**
   * The total number of tokens registered on the exchange
   * @return  The total number of tokens
   */
  public getNumTokens() {
    return this.tokens.length;
  }

  /**
   * Gets the token with the specified token ID
   * @param   tokenID   The ID of the token
   * @return  The token with the given tokenID
   */
  public getToken(tokenID: number) {
    return this.tokens[tokenID];
  }

  /// Accounts

  /**
   * The total number of accounts registered in the Merkle tree
   * (note that this can be less than registered on-chain because the account
   * registration needs to be processed in a block).
   * @return  The total number of accounts
   */
  public getNumAccounts() {
    return this.state.accounts.length;
  }

  /**
   * Gets the account with the specified account ID
   * @param   accountID   The ID of the account
   * @return  The account with the given accountID
   */
  public getAccount(accountID: number) {
    return this.state.accounts[accountID];
  }

  /**
   * Gets the account with the specified owner
   * @param   owner   The owner of the account
   * @return  The account with the given owner
   */
  public getAccountByOwner(owner: string) {
    return this.state.accounts[this.getAccountId(owner)];
  }

  /**
   * Gets the accountID of the specified owner
   * @param   owner   The owner of the account
   * @return  The accountID of the given owner
   */
  public getAccountId(owner: string) {
    return this.state.ownerToAccountId[owner];
  }

  /// Processed requests

  /**
   * The total number of requests processed in blocks on the exchange
   * @return  The total number of processed requests
   */
  public getNumProcessedRequests() {
    return this.state.processedRequests.length;
  }

  /**
   * Gets a processed request with the specified index
   * @return  The processed request
   */
  public getProcessedRequest(requestIdx: number) {
    return this.state.processedRequests[requestIdx];
  }

  /**
   * Gets the processed requests within the specified range.
   * This function will automatically clamp to a valid range.
   * @return  The processed requests
   */
  public getProcessedRequests(startIdx: number, count: number) {
    const requests: any[] = [];
    if (startIdx >= this.state.processedRequests.length) {
      return [];
    }
    const endIdx = Math.min(
      startIdx + count,
      this.state.processedRequests.length
    );
    for (let i = startIdx; i < endIdx; i++) {
      requests.push(this.getProcessedRequest(i));
    }
    return requests;
  }

  /**
   * Gets the processed requests that were processed in the specified block
   * @return  The processed requests in the given block
   */
  public getRequestsInBlock(blockIdx: number) {
    if (blockIdx === 0 || blockIdx >= this.blocks.length) {
      return [];
    }
    const block = this.getBlock(blockIdx);
    return this.getProcessedRequests(
      block.totalNumRequestsProcessed - block.numRequestsProcessed,
      block.numRequestsProcessed
    );
  }

  /// Deposits

  /**
   * Returns the total number of deposits done on-chain
   * @return  The total number of deposits
   */
  public getNumDeposits() {
    return this.state.deposits.length;
  }

  /**
   * Returns the deposit with the specified depositIdx
   * @return  The requested deposit
   */
  public getDeposit(depositIdx: number) {
    return this.state.deposits[depositIdx];
  }

  /**
   * Returns the deposits within the specified range.
   * This function will automatically clamp to a valid range.
   * @return  The requested deposits
   */
  public getDeposits(startIdx: number, count: number) {
    const deposits: Deposit[] = [];
    if (startIdx >= this.state.deposits.length) {
      return [];
    }
    const endIdx = Math.min(startIdx + count, this.state.deposits.length);
    for (let i = startIdx; i < endIdx; i++) {
      deposits.push(this.getDeposit(i));
    }
    return deposits;
  }

  /// On-chain withdrawals

  /**
   * Returns the total number of on-chain withdrawal requests
   * @return  The total number of on-chain withdrawals
   */
  public getNumOnchainWithdrawalRequests() {
    return this.state.onchainWithdrawals.length;
  }

  /**
   * Returns the withdrawal with the specified withdrawalIdx
   * @return  The requested deposit
   */
  public getOnchainWithdrawalRequest(withdrawalIdx: number) {
    return this.state.onchainWithdrawals[withdrawalIdx];
  }

  /**
   * Returns the withdrawals within the specified range.
   * This function will automatically clamp to a valid range.
   * @return  The requested on-chain withdrawals
   */
  public getOnchainWithdrawalRequests(startIdx: number, count: number) {
    const withdrawals: OnchainWithdrawal[] = [];
    if (startIdx >= this.state.onchainWithdrawals.length) {
      return [];
    }
    const endIdx = Math.min(
      startIdx + count,
      this.state.onchainWithdrawals.length
    );
    for (let i = startIdx; i < endIdx; i++) {
      withdrawals.push(this.getOnchainWithdrawalRequest(i));
    }
    return withdrawals;
  }

  /// Meta

  /**
   * Gets the ID of the exchange
   * @return  The exchange ID
   */
  public getExchangeId() {
    return this.state.exchangeId;
  }

  /**
   * Gets the address of the contract
   * @return  The address of the contract
   */
  public getAddress() {
    return this.exchangeAddress;
  }

  /**
   * Gets the exchange owner
   * @return  The owner of the exchange
   */
  public getOwner() {
    return this.owner;
  }

  /**
   * Gets the exchange operator
   * @return  The operator of the exchange
   */
  public getOperator() {
    return this.operator;
  }

  /**
   * Returns if this exchange has on-chain data-availability or not
   * @return  True if the exchange has on-chain data-availability, else false
   */
  public hasOnchainDataAvailability() {
    return this.state.onchainDataAvailability;
  }

  /**
   * Gets the forge mode of the exchange
   * @return  The forge mode of the exchange
   */
  public getForgeMode() {
    return this.forgeMode;
  }

  /**
   * Gets the protocol of the exchange
   * @return  The exchange's protocol
   */
  public getProtocol() {
    return this.protocol;
  }

  /**
   * Gets the implementaton address of the exchange
   * @return  The exchange's implementation
   */
  public getImplementationAddress() {
    return this.implementationAddress;
  }

  /**
   * Gets the time the exchange was created
   * @return  The exchange creation timestamp
   */
  public getExchangeCreationTimestamp() {
    return this.exchangeCreationTimestamp;
  }

  /**
   * Returns the exchange stake amount (in LRC)
   * @return  The amount staked in LRC
   */
  public getExchangeStake() {
    return this.protocol.getExchangeStake(this.state.exchangeId);
  }

  /**
   * Returns the protocol fee stake amount (in LRC)
   * @return  The amount staked in LRC
   */
  public getProtocolFeeStake() {
    return this.protocol.getProtocolFeeStake(this.state.exchangeId);
  }

  /**
   * Returns whether the exchange is shutdown
   * @return  True if the exchange is shutdown, else false
   */
  public isShutdown() {
    return this.shutdown;
  }

  /**
   * Returns the time when the exchange was shutdown
   * @return  The shutdownn start time.
   */
  public getShutdownStartTime() {
    return this.shutdownStartTime;
  }

  /**
   * Returns whether the exchange is in maintenance mode
   * @return  True if the exchange is in maintenance mode, else false
   */
  public isInMaintenenance() {
    return this.inMaintenenance;
  }

  /**
   * Returns whether the exchange is in withdrawal mode
   * @return  True if the exchange is in withdrawal mode, else false
   */
  public isInWithdrawalMode() {
    return this.inWithdrawalMode;
  }

  /**
   * Returns the total amount of seconds the exchange has been in withdrawal mode
   * @return  The total amount of seconds in maintenance mode
   */
  public getTotalTimeInMaintenanceSeconds() {
    return this.totalTimeInMaintenanceSeconds;
  }

  /**
   * Returns the fees for on-chain requests on this exchange
   * @return  The on-chain fees
   */
  public getExchangeFees() {
    return this.exchangeFees;
  }

  /**
   * Returns the current protocol fees on this exchange
   * @return  The protocol fees
   */
  public getProtocolFees() {
    return this.protocolFees;
  }

  /// Private

  private async processBlockSubmitted(event: any) {
    // Make sure the blocks are in the right order
    const blockIdx = parseInt(event.returnValues.blockIdx);
    if (blockIdx < this.blocks.length) {
      // Block was already processed
      //console.log("skip: " + blockIdx);
      return;
    }
    assert.equal(blockIdx, this.blocks.length, "Unexpected blockIdx");
    log.DEBUG("processBlockCommitted event, blockIdx:", blockIdx);

    // Get the timestamp from the block
    const ethereumBlock = await this.web3.eth.getBlock(event.blockNumber);
    const timestamp = Number(ethereumBlock.timestamp);

    /*let merkleRoot = "0";
    let blockType = 0;
    let blockSize = 0;
    let blockVersion = 0;
    let onchainData = "0x";
    let offchainData = "0x";
    let data = "";*/

    // Get the block data from the transaction data
    const submitBlocksFunctionSignature = "0x65f573a8";

    const transaction = await this.web3.eth.getTransaction(
      event.transactionHash
    );
    //console.log(transaction.input);
    if (transaction.input.startsWith(submitBlocksFunctionSignature)) {
      // Get the inputs to commitBlock
      // Note: this will not work if an operator contract is used with a different function signature
      const decodedInputs = this.web3.eth.abi.decodeParameters(
        [
          {
            "struct ExchangeData.Block[]": {
              blockType: "uint8",
              blockSize: "uint16",
              blockVersion: "uint8",
              data: "bytes",
              proof: "uint256[8]",
              auxiliaryData: "bytes",
              offchainData: "bytes"
            }
          },
          "address"
        ],
        "0x" + transaction.input.slice(2 + 4 * 2)
      );
      //console.log(decodedInputs);
      const numBlocks = decodedInputs[0].length;
      //console.log("numBlocks: " + numBlocks);
      for (let i = 0; i < numBlocks; i++) {
        // Get the block data
        const blockType = parseInt(decodedInputs[0][i].blockType);
        const blockSize = parseInt(decodedInputs[0][i].blockSize);
        const blockVersion = parseInt(decodedInputs[0][i].blockVersion);
        const onchainData = decodedInputs[0][i].data;
        const offchainData = decodedInputs[0][i].offchainData;
        const data = decodedInputs[4] === null ? "0x" : onchainData;

        /*if (onchainData.startsWith("0x00")) {
          data = "0x" + onchainData.slice(4);
        } else if (onchainData.startsWith("0x01")) {
          // Decompress using the decompressor contract
          // We assume here that the decompressor contract is static, as in it always behaves the same no matter when it is called
          const decompressorAddress = "0x" + onchainData.slice(4, 4 + 40);
          const compressedData = "0x" + onchainData.slice(4 + 40);
          this.decompressor.options.address = decompressorAddress;
          data = await this.decompressor.methods
            .decompress(this.web3.utils.hexToBytes(compressedData))
            .call();
        } else {
          // console.log("unsupported data compression mode");
          data = onchainData;
        }*/

        // Get the new Merkle root
        const bs = new Bitstream(data);
        if (bs.length() < 4 + 32 + 32) {
          // console.log("Invalid block data: " + data);
          return;
        }

        const merkleRoot = bs.extractUint(4 + 32).toString(10);
        // console.log("merkleRoot: " + merkleRoot);

        // Get the previous block
        const lastBlock = this.blocks[this.blocks.length - 1];

        // Create the block
        const newBlock: Block = {
          exchangeId: this.state.exchangeId,
          blockIdx: blockIdx + i,

          blockType,
          blockSize,
          blockVersion,
          data,
          offchainData,

          operator: this.operator,
          origin: transaction.from,

          blockFeeRewarded: new BN(0),
          blockFeeFined: new BN(0),

          merkleRoot,

          timestamp,

          numRequestsProcessed: 0,
          totalNumRequestsProcessed: lastBlock.totalNumRequestsProcessed,

          totalNumTradesProccesed: lastBlock.totalNumTradesProccesed,
          totalNumDepositsProccesed: lastBlock.totalNumDepositsProccesed,
          totalNumOnchainWithdrawalsProcessed:
            lastBlock.totalNumOnchainWithdrawalsProcessed,
          totalNumOffchainWithdrawalsProcessed:
            lastBlock.totalNumOffchainWithdrawalsProcessed,
          totalNumOrderCancellationsProcessed:
            lastBlock.totalNumOrderCancellationsProcessed,
          totalNumOrderInternalTransfersProcessed:
            lastBlock.totalNumOrderInternalTransfersProcessed,

          transactionHash: event.transactionHash
        };
        this.blocks.push(newBlock);
        this.processBlock(newBlock, false);

        // TODO: remove (Only done here for debugging)
        if (this.state.onchainDataAvailability) {
          this.buildMerkleTree();
          for (let a = 0; a < this.state.accounts.length; a++) {
            this.merkleTree.createProof(a);
          }
        }
      }
    } else {
      console.log(
        "block " +
          blockIdx +
          " was committed with an unsupported function signature"
      );
    }
  }

  private async processAccountCreated(event: any) {
    const owner = event.returnValues.owner;
    const accountID = parseInt(event.returnValues.id);
    this.state.ownerToAccountId[owner] = accountID;
    this.state.accountIdToOwner[accountID] = owner;
  }

  private async processDepositRequested(event: any) {
    // Make sure the deposits are in the right order
    assert.equal(
      this.state.deposits.length,
      parseInt(event.returnValues.depositIdx),
      "Unexpected depositIdx"
    );

    // Get the timestamp from the block
    const ethereumBlock = await this.web3.eth.getBlock(event.blockNumber);
    const timestamp = Number(ethereumBlock.timestamp);

    const deposit: Deposit = {
      exchangeId: this.state.exchangeId,
      depositIdx: parseInt(event.returnValues.depositIdx),
      timestamp,

      accountID: parseInt(event.returnValues.accountID),
      tokenID: parseInt(event.returnValues.tokenID),
      amount: new BN(event.returnValues.amount, 10),
      publicKeyX: event.returnValues.pubKeyX,
      publicKeyY: event.returnValues.pubKeyY,

      transactionHash: event.transactionHash
    };
    this.state.deposits.push(deposit);
  }

  private async processWithdrawalRequested(event: any) {
    // Make sure the onchain withdrawals are in the right order
    assert.equal(
      this.state.onchainWithdrawals.length,
      parseInt(event.returnValues.withdrawalIdx),
      "Unexpected withdrawalIdx"
    );

    // Get the timestamp from the block
    const ethereumBlock = await this.web3.eth.getBlock(event.blockNumber);
    const timestamp = Number(ethereumBlock.timestamp);

    const onchainWithdrawal: OnchainWithdrawal = {
      exchangeId: this.state.exchangeId,
      withdrawalIdx: parseInt(event.returnValues.withdrawalIdx),
      timestamp,

      accountID: parseInt(event.returnValues.accountID),
      tokenID: parseInt(event.returnValues.tokenID),
      amountRequested: new BN(event.returnValues.amount, 10),

      transactionHash: event.transactionHash
    };
    this.state.onchainWithdrawals.push(onchainWithdrawal);
  }

  private async processTokenRegistered(event: any) {
    // Make sure the tokens are in the right order
    assert.equal(
      this.tokens.length,
      parseInt(event.returnValues.tokenId),
      "Unexpected tokenId"
    );
    const token: Token = {
      exchangeId: this.state.exchangeId,
      tokenID: this.tokens.length,
      address: event.returnValues.token,
      enabled: true
    };
    this.tokens.push(token);
  }

  private async processShutdown(event: any) {
    this.shutdown = true;
    this.shutdownStartTime = parseInt(event.returnValues.timestamp);
  }

  private async processOperatorChanged(event: any) {
    assert(
      this.operator === event.returnValues.oldOperator,
      "unexpected operator"
    );
    this.operator = event.returnValues.newOperator;
  }

  private async processBlockFeeWithdrawn(event: any) {
    const blockIdx = parseInt(event.returnValues.blockIdx);
    assert(blockIdx < this.blocks.length, "unexpected blockIdx");
    const block = this.blocks[blockIdx];
    block.blockFeeRewarded = new BN(event.returnValues.amountRewarded, 10);
    block.blockFeeFined = new BN(event.returnValues.amountFined, 10);
  }

  private async processFeesUpdated(event: any) {
    assert(
      this.state.exchangeId === parseInt(event.returnValues.exchangeId),
      "unexpected exchangeId"
    );
    this.exchangeFees.accountCreationFeeETH = new BN(
      event.returnValues.accountCreationFeeETH,
      10
    );
    this.exchangeFees.accountUpdateFeeETH = new BN(
      event.returnValues.accountUpdateFeeETH,
      10
    );
    this.exchangeFees.depositFeeETH = new BN(
      event.returnValues.depositFeeETH,
      10
    );
    this.exchangeFees.withdrawalFeeETH = new BN(
      event.returnValues.withdrawalFeeETH,
      10
    );
  }

  private async processProtocolFeesUpdated(event: any) {
    this.protocolFees.takerFeeBips = parseInt(event.returnValues.takerFeeBips);
    this.protocolFees.makerFeeBips = parseInt(event.returnValues.makerFeeBips);
    this.protocolFees.previousTakerFeeBips = parseInt(
      event.returnValues.previousTakerFeeBips
    );
    this.protocolFees.previousMakerFeeBips = parseInt(
      event.returnValues.previousMakerFeeBips
    );
  }

  private async processOwnershipTransferred(event: any) {
    assert(this.owner === event.returnValues.oldOwner, "unexpected owner");
    this.owner = event.returnValues.newOwner;
  }

  // Apply the block changes to the current state
  private processBlock(block: Block, replay: boolean) {
    let requests: any[] = [];
    try {
      if (block.blockType === BlockType.RING_SETTLEMENT) {
        requests = RingSettlementProcessor.processBlock(this.state, block);
        block.totalNumTradesProccesed += replay ? 0 : requests.length;
      } else if (block.blockType === BlockType.DEPOSIT) {
        requests = DepositProcessor.processBlock(this.state, block);
        block.totalNumDepositsProccesed += replay ? 0 : requests.length;
      } else if (block.blockType === BlockType.ONCHAIN_WITHDRAWAL) {
        requests = OnchainWithdrawalProcessor.processBlock(this.state, block);
        block.totalNumOnchainWithdrawalsProcessed += replay
          ? 0
          : requests.length;
      } else if (block.blockType === BlockType.OFFCHAIN_WITHDRAWAL) {
        requests = OffchainWithdrawalProcessor.processBlock(this.state, block);
        block.totalNumOffchainWithdrawalsProcessed += replay
          ? 0
          : requests.length;
      } else if (block.blockType === BlockType.INTERNAL_TRANSFER) {
        requests = InternalTransferProcessor.processBlock(this.state, block);
        block.totalNumOrderInternalTransfersProcessed += replay
          ? 0
          : requests.length;
      } else {
        assert(false, "Unknown block type");
      }
    } catch (e) {
      // console.log("Error detected while processing block: ");
      // console.log(e);
    }

    if (!replay) {
      block.numRequestsProcessed = requests.length;
      block.totalNumRequestsProcessed += requests.length;
      this.state.processedRequests.push(...requests);
    }
  }

  /**
   * Resets the state stored in the Merkle tree back to its initial state
   */
  private setGenesisState() {
    this.state.accounts = [];
    const protocolPoolAccount: Account = {
      exchangeId: this.state.exchangeId,
      accountId: 0,
      owner: Constants.zeroAddress,

      publicKeyX: "0",
      publicKeyY: "0",
      nonce: 0,
      balances: {}
    };
    this.state.accounts.push(protocolPoolAccount);
  }
}
