import BN from "bn.js";
const fs = require("fs");
import Web3 from "web3";
import { Bitstream } from "./bitstream";
import { Constants } from "./constants";
import { decompressLZ } from "./compression";
const poseidon = require("./poseidon");
import { ProtocolV3 } from "./protocol_v3";
import { SparseMerkleTree } from "./sparse_merkle_tree";
import {
  BlockContext,
  BlockType,
  ForgeMode,
  Block,
  Deposit,
  OnchainWithdrawal,
  TradeHistory,
  Token,
  Balance,
  Account,
  OnchainAccountLeaf,
  OnchainBalanceLeaf,
  WithdrawFromMerkleTreeData,
  ExchangeState,
  ProtocolFees
} from "./types";
import { DepositProcessor } from "./request_processors/deposit_processor";
import { AccountUpdateProcessor } from "./request_processors/account_update_processor";
import { SpotTradeProcessor } from "./request_processors/spot_trade_processor";
import { TransferProcessor } from "./request_processors/transfer_processor";
import { WithdrawalProcessor } from "./request_processors/withdrawal_processor";
import { NewAccountProcessor } from "./request_processors/new_account_processor";
import { OwnerChangeProcessor } from "./request_processors/owner_change_processor";
import * as log from "./logs";


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

  private syncedToEthereumBlockIdx: number;

  private owner: string;
  private operator: string;

  private shutdown: boolean;
  private shutdownStartTime: number;
  private inWithdrawalMode: boolean;
  private withdrawalModeStartTime: number;

  private tokens: Token[] = [];

  private state: ExchangeState;

  private blocks: Block[] = [];

  private merkleTree: SparseMerkleTree;

  // decimal representation of `0x1dacdc3f6863d9db1d903e7285ebf74b61f02d585ccb52ecaeaf97dbb773becf`
  private genesisMerkleRoot =
    "13422490397723095974327695797813848518088539216215104429864410479629968850639";

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

    this.exchange = new web3.eth.Contract(JSON.parse(this.exchangeV3Abi));
    this.exchange.options.address = this.exchangeAddress;

    this.exchangeCreationTimestamp = await this.exchange.methods
      .getExchangeCreationTimestamp()
      .call();

    this.shutdown = false;
    this.shutdownStartTime = 0;
    this.inWithdrawalMode = false;
    this.withdrawalModeStartTime = 0;

    // Reset state
    this.state = new ExchangeState(exchangeId, []);

    // Create the genesis block
    const genesisBlock: Block = {
      exchangeId,
      blockIdx: 0,

      blockType: BlockType.NOOP,
      blockSize: 0,
      blockVersion: 0,
      data: "0x",
      offchainData: "0x",

      operator: Constants.zeroAddress,
      origin: Constants.zeroAddress,

      blockFee: new BN(0),

      merkleRoot: this.genesisMerkleRoot,
      timestamp: this.exchangeCreationTimestamp,

      numRequestsProcessed: 0,
      totalNumRequestsProcessed: 0,

      transactionHash: Constants.zeroAddress
    };
    this.blocks.push(genesisBlock);

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
      } else if (event.event === "DepositRequested") {
        await this.processDepositRequested(event);
      } else if (event.event === "WithdrawalRequested") {
        await this.processWithdrawalRequested(event);
      } else if (event.event === "TokenRegistered") {
        await this.processTokenRegistered(event);
      } else if (event.event === "Shutdown") {
        await this.processShutdown(event);
      } else if (event.event === "WithdrawalModeActivated") {
        await this.processWithdrawalModeActivated(event);
      } else if (event.event === "OperatorChanged") {
        await this.processOperatorChanged(event);
      } else if (event.event === "ProtocolFeesUpdated") {
        await this.processProtocolFeesUpdated(event);
      } else if (event.event === "OwnershipTransferred") {
        await this.processOwnershipTransferred(event);
      }
    }
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
    const hasher = poseidon.createHash(5, 6, 52);
    const accountHasher = poseidon.createHash(7, 6, 52);

    // Make empty trees so we have all necessary default values
    const tradeHistoryMerkleTree = new SparseMerkleTree(Constants.BINARY_TREE_DEPTH_TRADING_HISTORY/2);
    tradeHistoryMerkleTree.newTree(hasher([0, 0]).toString(10));
    const balancesMerkleTree = new SparseMerkleTree(Constants.BINARY_TREE_DEPTH_TOKENS/2);
    balancesMerkleTree.newTree(
      hasher([0, Constants.INDEX_BASE, tradeHistoryMerkleTree.getRoot()]).toString(10)
    );
    this.merkleTree = new SparseMerkleTree(Constants.BINARY_TREE_DEPTH_ACCOUNTS/2);
    this.merkleTree.newTree(
      accountHasher([0, 0, 0, 0, 0, balancesMerkleTree.getRoot()]).toString(10)
    );

    assert.equal(
      this.merkleTree.getRoot(),
      this.genesisMerkleRoot,
      "Genesis Merkle tree root inconsistent"
    );

    // Run over all account data and build the Merkle tree
    for (const account of this.state.accounts) {
      account.balancesMerkleTree = new SparseMerkleTree(Constants.BINARY_TREE_DEPTH_TOKENS/2);
      account.balancesMerkleTree.newTree(
        hasher([0, Constants.INDEX_BASE, tradeHistoryMerkleTree.getRoot()]).toString(10)
      );
      for (const tokenID of Object.keys(account.balances)) {
        const balanceValue = account.balances[Number(tokenID)];
        balanceValue.tradeHistoryTree = new SparseMerkleTree(Constants.BINARY_TREE_DEPTH_TRADING_HISTORY/2);
        balanceValue.tradeHistoryTree.newTree(hasher([0, 0]).toString(10));
        for (const orderID of Object.keys(balanceValue.tradeHistory)) {
          const tradeHistoryValue = balanceValue.tradeHistory[Number(orderID)];
          balanceValue.tradeHistoryTree.update(
            Number(orderID),
            hasher([
              tradeHistoryValue.filled,
              tradeHistoryValue.orderID
            ]).toString(10)
          );
        }
        account.balancesMerkleTree.update(
          Number(tokenID),
          hasher([
            balanceValue.balance,
            balanceValue.index,
            balanceValue.tradeHistoryTree.getRoot()
          ]).toString(10)
        );
      }
      this.merkleTree.update(
        account.accountId,
        accountHasher([
          account.owner,
          account.publicKeyX,
          account.publicKeyY,
          account.nonce,
          account.walletHash,
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

    const hasher = poseidon.createHash(5, 6, 52);
    const tradeHistoryTree = new SparseMerkleTree(Constants.BINARY_TREE_DEPTH_TRADING_HISTORY/2);
    tradeHistoryTree.newTree(hasher([0, 0]).toString(10));

    const accountLeaf: OnchainAccountLeaf = {
      accountID: account.accountId,
      owner: account.owner,
      pubKeyX: account.publicKeyX,
      pubKeyY: account.publicKeyY,
      nonce: account.nonce,
      walletHash: account.walletHash
    };
    const balanceLeaf: OnchainBalanceLeaf = {
      tokenID,
      balance: account.getBalanceRaw(tokenID).balance.toString(10),
      index: account.getBalanceRaw(tokenID).index.toString(10),
      tradeHistoryRoot: account.getBalanceRaw(tokenID).tradeHistoryTree !== undefined ?
        account.getBalanceRaw(tokenID).tradeHistoryTree.getRoot() :
        tradeHistoryTree.getRoot()
    };
    const withdrawFromMerkleTreeData: WithdrawFromMerkleTreeData = {
      accountLeaf,
      balanceLeaf,
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
   * Returns whether the exchange is in withdrawal mode
   * @return  True if the exchange is in withdrawal mode, else false
   */
  public isInWithdrawalMode() {
    return this.inWithdrawalMode;
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
    //const submitBlocksFunctionSignature = "0x65f573a8";
    const submitBlocksFunctionSignature = "0x14867212";

    const transaction = await this.web3.eth.getTransaction(
      event.transactionHash
    );
    //console.log(transaction.input);
    if (transaction.input.startsWith(submitBlocksFunctionSignature)) {
      const decodedCompressedInput = this.web3.eth.abi.decodeParameters(
        ["bytes"],
        "0x" + transaction.input.slice(2 + 4 * 2)
      );
      const data = decompressLZ(decodedCompressedInput[0]);
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
        "0x" + data.slice(2 + 4 * 2)
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

          blockFee: new BN(0),

          merkleRoot,

          timestamp,

          numRequestsProcessed: 0,
          totalNumRequestsProcessed: lastBlock.totalNumRequestsProcessed,

          transactionHash: event.transactionHash
        };
        this.blocks.push(newBlock);
        this.processBlock(newBlock);

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

  private async processDepositRequested(event: any) {
    //console.log(event);
    // Get the timestamp from the block
    const ethereumBlock = await this.web3.eth.getBlock(event.blockNumber);
    const timestamp = Number(ethereumBlock.timestamp);

    const deposit: Deposit = {
      exchangeId: this.state.exchangeId,
      timestamp,

      owner: event.returnValues.owner,
      token: event.returnValues.token,
      amount: new BN(event.returnValues.amount, 10),
      index: new BN(event.returnValues.index, 10),
      fee: new BN(event.returnValues.fee, 10),

      transactionHash: event.transactionHash
    };
    this.state.deposits.push(deposit);
  }

  private async processWithdrawalRequested(event: any) {
    console.log(event);

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

  private async processWithdrawalModeActivated(event: any) {
    this.inWithdrawalMode = true;
    this.withdrawalModeStartTime = parseInt(event.returnValues.timestamp);
  }

  private async processOperatorChanged(event: any) {
    assert(
      this.operator === event.returnValues.oldOperator,
      "unexpected operator"
    );
    this.operator = event.returnValues.newOperator;
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
  private processBlock(block: Block) {
    let requests: any[] = [];

    let data = new Bitstream(block.data);
    let offset = 0;

    // General data
    offset += 4 + 32 + 32 + 4;
    const protocolFeeTakerBips = data.extractUint8(offset);
    offset += 1;
    const protocolFeeMakerBips = data.extractUint8(offset);
    offset += 1;
    const numConditionalTransactions = data.extractUint32(offset);
    offset += 4;
    const operatorAccountID = data.extractUint24(offset);
    offset += 3;

    const ctx: BlockContext = {
      protocolFeeTakerBips,
      protocolFeeMakerBips,
      operatorAccountID
    };

    for (let i = 0; i < block.blockSize; i++) {
      const txData = new Bitstream(data.extractData(offset, Constants.TX_DATA_AVAILABILITY_SIZE));
      const txType = txData.extractUint8(0);

      let request: any;
      if (txType === BlockType.NOOP) {
        // Do nothing
      } else if (txType === BlockType.DEPOSIT) {
        request = DepositProcessor.process(this.state, ctx, txData);
      } else if (txType === BlockType.ACCOUNT_UPDATE) {
        request = AccountUpdateProcessor.process(this.state, ctx, txData);
      } else if (txType === BlockType.SPOT_TRADE) {
        request = SpotTradeProcessor.process(this.state, ctx, txData);
      } else if (txType === BlockType.TRANSFER) {
        request = TransferProcessor.process(this.state, ctx, txData);
      } else if (txType === BlockType.WITHDRAWAL) {
        request = WithdrawalProcessor.process(this.state, ctx, txData);
      } else if (txType === BlockType.NEW_ACCOUNT) {
        request = NewAccountProcessor.process(this.state, ctx, txData);
      } else if (txType === BlockType.OWNER_CHANGE) {
        request = OwnerChangeProcessor.process(this.state, ctx, txData);
      } else {
        assert(false, "unknown transaction type: " + txType);
      }

      requests.push(request);
      offset += Constants.TX_DATA_AVAILABILITY_SIZE;
    }

    // Update operator nonce
    this.state.getAccount(ctx.operatorAccountID).nonce++;

    block.numRequestsProcessed = requests.length;
    block.totalNumRequestsProcessed += requests.length;
    this.state.processedRequests.push(...requests);
  }
}
