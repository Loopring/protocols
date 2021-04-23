import BN = require("bn.js");
import { AmmPool, Permit, PermitUtils } from "./ammUtils";
import { expectThrow } from "./expectThrow";
import { Constants, roundToFloatValue } from "loopringV3.js";
import {
  BalanceSnapshot,
  ExchangeTestUtil,
  TransferUtils
} from "./testExchangeUtil";
import { AuthMethod, Transfer } from "./types";
import { SignatureType, sign, verifySignature } from "../util/Signature";
import * as sigUtil from "eth-sig-util";
import { Bitstream } from "loopringV3.js";
import { logDebug } from "./logs";

const AgentRegistry = artifacts.require("AgentRegistry");

const BridgeContract = artifacts.require("Bridge");
const TestSwapper = artifacts.require("TestSwapper");
const TestSwappperBridgeConnector = artifacts.require(
  "TestSwappperBridgeConnector"
);
const TestMigrationBridgeConnector = artifacts.require(
  "TestMigrationBridgeConnector"
);

export interface BridgeDeposit {
  owner: string;
  token: string;
  amount: string;
}

export interface InternalDeposit {
  owner: string;
  tokenID: number;
  amount: string;
}

export interface TokenData {
  token: string;
  tokenID: number;
  amount: string;
}

export interface ConnectorTx {
  owner: string;
  token: string;
  amount: string;
  feeToken: string;
  userData: string;
  minGas: number;
  maxFee: string;
  validUntil: number;
  connector: string;
  groupData: string;
  expectedDeposit?: BridgeDeposit;
}

export interface ConnectorTxGroup {
  groupData: string;
  transactions: ConnectorTx[];
}

export interface ConnectorCall {
  connector: string;
  gasLimit: number;
  txGroups: ConnectorTxGroup[];
  totalMinGas: number;
  tokens: TokenData[];
}

export interface TransferBatch {
  batchID: number;
  amounts: string[];
}

export interface BridgeOperation {
  transferBatches: TransferBatch[];
  connectorCalls: ConnectorCall[];
  tokens: TokenData[];
}

export interface ConnectorTxWrapper {
  transfer: Transfer;
  connector: string;
  groupData: string;
  transaction: ConnectorTx;
}

export namespace CollectTransferUtils {
  export function toTypedData(
    callWrapper: ConnectorTxWrapper,
    verifyingContract: string
  ) {
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" }
        ],
        ConnectorTx: [
          { name: "tokenID", type: "uint16" },
          { name: "amount", type: "uint96" },
          { name: "feeTokenID", type: "uint16" },
          { name: "maxFee", type: "uint96" },
          { name: "validUntil", type: "uint32" },
          { name: "storageID", type: "uint32" },
          { name: "minGas", type: "uint32" },
          { name: "connector", type: "address" },
          { name: "groupData", type: "bytes" },
          { name: "userData", type: "bytes" }
        ]
      },
      primaryType: "ConnectorTx",
      domain: {
        name: "Bridge",
        version: "1.0",
        chainId: new BN(/*await web3.eth.net.getId()*/ 1),
        verifyingContract
      },
      message: {
        tokenID: callWrapper.transfer.tokenID,
        amount: callWrapper.transfer.amount,
        feeTokenID: callWrapper.transfer.feeTokenID,
        maxFee: callWrapper.transaction.maxFee,
        validUntil: callWrapper.transaction.validUntil,
        storageID: callWrapper.transfer.storageID,
        minGas: callWrapper.transaction.minGas,
        connector: callWrapper.connector,
        groupData: callWrapper.groupData,
        userData: callWrapper.transaction.userData
      }
    };
    return typedData;
  }

  export function getHash(
    callWrapper: ConnectorTxWrapper,
    verifyingContract: string
  ) {
    const typedData = this.toTypedData(callWrapper, verifyingContract);
    return sigUtil.TypedDataUtils.sign(typedData);
  }
}

export class Bridge {
  public ctx: ExchangeTestUtil;
  public contract: any;
  public address: string;

  public accountID: number;

  public relayer: string;

  public migrationConnector: string;

  constructor(ctx: ExchangeTestUtil) {
    this.ctx = ctx;
    this.relayer = ctx.testContext.orderOwners[11];
  }

  public async setup() {
    this.accountID = this.ctx.accounts[this.ctx.exchangeId].length;

    this.contract = await BridgeContract.new(
      this.ctx.exchange.address,
      this.accountID
    );

    // Create the Bridge account
    const owner = this.contract.address;
    const deposit = await this.ctx.deposit(
      this.ctx.testContext.orderOwners[0],
      owner,
      "ETH",
      new BN(1),
      { autoSetKeys: false }
    );
    assert(deposit.accountID === this.accountID, "unexpected accountID");

    this.address = this.contract.address;
  }

  public async setMigrationConnectorAddress(migrationConnector: string) {
    this.migrationConnector = migrationConnector;
  }

  public async batchDeposit(deposits: BridgeDeposit[]) {
    const tokens: Map<string, BN> = new Map<string, BN>();
    for (const deposit of deposits) {
      if (!tokens.has(deposit.token)) {
        tokens.set(deposit.token, new BN(0));
      }
      tokens.set(
        deposit.token,
        tokens.get(deposit.token).add(new BN(deposit.amount))
      );
    }

    let ethValue = new BN(0);
    for (const [token, amount] of tokens.entries()) {
      if (token === Constants.zeroAddress) {
        ethValue = tokens.get(Constants.zeroAddress);
      } else {
        await this.ctx.setBalanceAndApprove(this.relayer, token, amount);
      }
    }

    const tx = await this.contract.batchDeposit(deposits, {
      from: this.relayer,
      value: ethValue
    });
    logDebug(
      "\x1b[46m%s\x1b[0m",
      "[BatchxDepositor] Gas used: " + tx.receipt.gasUsed
    );
    const transferEvents = await this.ctx.getEvents(
      this.contract,
      "BatchDeposited"
    );

    const depositEvents = await this.ctx.assertEventsEmitted(
      this.ctx.exchange,
      "DepositRequested",
      tokens.size
    );

    // Process the deposits
    for (const [token, amount] of tokens.entries()) {
      await this.ctx.requestDeposit(this.address, token, amount);
    }

    await this.ctx.submitTransactions();
    await this.ctx.submitPendingBlocks();

    return transferEvents;
  }

  public async setupCalls(calls: ConnectorTx[]) {
    for (const call of calls) {
      await this.ctx.deposit(
        call.owner,
        call.owner,
        call.token,
        new BN(call.amount)
      );
      call.token = await this.ctx.getTokenAddress(call.token);
    }

    await this.ctx.submitTransactions();
    await this.ctx.submitPendingBlocks();
  }

  public decodeTransfers(_data: string) {
    const transfers: InternalDeposit[] = [];
    const data = new Bitstream(_data);
    for (let i = 0; i < data.length() / 34; i++) {
      const transfer: InternalDeposit = {
        owner: data.extractAddress(i * 34 + 0),
        tokenID: data.extractUint16(i * 34 + 32),
        amount: data.extractUint96(i * 34 + 20).toString(10)
      };
      transfers.push(transfer);
    }
    return transfers;
  }

  public async submitBridgeOperation(
    transferEvents: any[],
    calls: ConnectorTx[],
    expectedSuccess?: boolean[],
    changeTransfers?: boolean
  ) {
    changeTransfers = changeTransfers ? true : false;

    const bridgeOperation: BridgeOperation = {
      transferBatches: [],
      connectorCalls: [],
      tokens: []
    };

    const blockCallback = this.ctx.addBlockCallback(this.address);

    for (const event of transferEvents) {
      const amounts: string[] = [];
      const transfers = this.decodeTransfers(event.transfersData);
      for (let i = 0; i < transfers.length; i++) {
        const transfer = transfers[i];
        transfer.amount = changeTransfers
          ? new BN(transfer.amount).div(new BN(2)).toString(10)
          : transfer.amount;
        await this.ctx.transfer(
          this.address,
          transfer.owner,
          this.ctx.getTokenAddressFromID(transfer.tokenID),
          new BN(transfer.amount),
          this.ctx.getTokenAddressFromID(transfer.tokenID),
          new BN(0),
          {
            authMethod: AuthMethod.NONE,
            amountToDeposit: new BN(0),
            feeToDeposit: new BN(0),
            transferToNew: true
          }
        );
        amounts.push(transfer.amount);
      }
      bridgeOperation.transferBatches.push({
        batchID: event.batchID.toNumber(),
        amounts
      });
    }

    const tokenMap: Map<string, BN> = new Map<string, BN>();
    for (const call of calls) {
      if (!tokenMap.has(call.token)) {
        tokenMap.set(call.token, new BN(0));
      }
      tokenMap.set(
        call.token,
        tokenMap.get(call.token).add(new BN(call.amount))
      );
    }

    for (const [token, amount] of tokenMap.entries()) {
      bridgeOperation.tokens.push({
        token: token,
        tokenID: await this.ctx.getTokenID(token),
        amount: amount.toString(10)
      });
    }

    // Sort the calls on connector and group
    for (const call of calls) {
      let connectorCall: ConnectorCall;
      for (let c = 0; c < bridgeOperation.connectorCalls.length; c++) {
        if (bridgeOperation.connectorCalls[c].connector === call.connector) {
          connectorCall = bridgeOperation.connectorCalls[c];
          break;
        }
      }
      if (connectorCall === undefined) {
        const connectorTokens: TokenData[] = [];
        for (const tokenData of bridgeOperation.tokens) {
          connectorTokens.push({
            token: tokenData.token,
            tokenID: tokenData.tokenID,
            amount: "0"
          });
        }
        connectorCall = {
          connector: call.connector,
          gasLimit: 2000000,
          totalMinGas: 0,
          txGroups: [],
          tokens: connectorTokens
        };
        bridgeOperation.connectorCalls.push(connectorCall);
      }

      let group: ConnectorTxGroup;
      for (let g = 0; g < connectorCall.txGroups.length; g++) {
        if (connectorCall.txGroups[g].groupData === call.groupData) {
          group = connectorCall.txGroups[g];
          break;
        }
      }
      if (group === undefined) {
        group = {
          groupData: call.groupData,
          transactions: []
        };
        connectorCall.txGroups.push(group);
      }
      group.transactions.push(call);

      let tokenData: TokenData;
      for (let t = 0; t < connectorCall.tokens.length; t++) {
        if (connectorCall.tokens[t].token === call.token) {
          tokenData = connectorCall.tokens[t];
          break;
        }
      }
      assert(tokenData !== undefined, "invalid state");
      tokenData.amount = new BN(tokenData.amount)
        .add(new BN(call.amount))
        .toString(10);

      connectorCall.totalMinGas += call.minGas;
    }

    //
    // Do L2 transactions
    //

    for (const connectorCall of bridgeOperation.connectorCalls) {
      for (const group of connectorCall.txGroups) {
        for (const transaction of group.transactions) {
          const transfer = await this.ctx.transfer(
            transaction.owner,
            this.address,
            transaction.token,
            new BN(transaction.amount),
            transaction.feeToken,
            new BN(0),
            {
              authMethod: AuthMethod.NONE,
              amountToDeposit: new BN(0),
              feeToDeposit: new BN(0)
            }
          );

          const bridgeCallWrapper: ConnectorTxWrapper = {
            transfer,
            transaction,
            connector: connectorCall.connector,
            groupData: group.groupData
          };
          const txHash = CollectTransferUtils.getHash(
            bridgeCallWrapper,
            this.address
          );
          await this.ctx.requestSignatureVerification(
            transaction.owner,
            this.ctx.hashToFieldElement("0x" + txHash.toString("hex"))
          );
        }
      }
    }

    for (const token of bridgeOperation.tokens) {
      await this.ctx.requestWithdrawal(
        this.address,
        token.token,
        new BN(token.amount),
        token.token,
        new BN(0),
        {
          authMethod: AuthMethod.NONE
        }
      );
    }

    // Set the pool transaction data on the callback
    blockCallback.auxiliaryData = this.encodeBridgeOperation(bridgeOperation);
    blockCallback.numTxs = calls.length * 2 + bridgeOperation.tokens.length;
    for (const batch of bridgeOperation.transferBatches) {
      blockCallback.numTxs += batch.amounts.length;
    }

    await this.ctx.submitTransactions();
    await this.ctx.submitPendingBlocks();

    const connectorCallResultEvents = await this.ctx.assertEventsEmitted(
      this.contract,
      "ConnectorTransacted",
      bridgeOperation.connectorCalls.length
    );

    if (expectedSuccess === undefined) {
      expectedSuccess = new Array(bridgeOperation.connectorCalls.length).fill(
        true
      );
    }

    for (let i = 0; i < connectorCallResultEvents.length; i++) {
      assert(
        bridgeOperation.connectorCalls[i].connector ===
          connectorCallResultEvents[i].connector,
        "unexpected success"
      );
      assert(
        expectedSuccess[i] === connectorCallResultEvents[i].success,
        "unexpected success"
      );
    }

    const expectedDepositTransfers: BridgeDeposit[] = [];
    const expectedMigrationTransfers: BridgeDeposit[] = [];
    for (const connectorCall of bridgeOperation.connectorCalls) {
      for (const group of connectorCall.txGroups) {
        for (const transaction of group.transactions) {
          if (transaction.expectedDeposit) {
            if (connectorCall.connector === this.migrationConnector) {
              expectedMigrationTransfers.push(transaction.expectedDeposit);
            } else {
              expectedDepositTransfers.push(transaction.expectedDeposit);
            }
          }
        }
      }
    }

    const newTransferEvents = await this.ctx.getEvents(
      this.contract,
      "BatchDeposited"
    );
    if (
      expectedDepositTransfers.length + expectedMigrationTransfers.length >
      0
    ) {
      assert.equal(
        newTransferEvents.length,
        expectedMigrationTransfers.length > 0 ? 2 : 1,
        "unexpected number of transfer events"
      );

      for (let c = 0; c < newTransferEvents.length; c++) {
        const transfers = this.decodeTransfers(
          newTransferEvents[c].transfersData
        );
        const expectedTransfers =
          newTransferEvents.length > 1 && c == 0
            ? expectedMigrationTransfers
            : expectedDepositTransfers;

        assert.equal(
          transfers.length,
          expectedTransfers.length,
          "unexpected number of new transfers"
        );
        for (let i = 0; i < transfers.length; i++) {
          assert.equal(
            transfers[i].owner.toLowerCase(),
            expectedTransfers[i].owner.toLowerCase(),
            "unexpected owner"
          );
          assert.equal(
            this.ctx.getTokenAddressFromID(transfers[i].tokenID),
            this.ctx.getTokenAddress(expectedTransfers[i].token),
            "unexpected token"
          );
          assert.equal(
            transfers[i].amount,
            expectedTransfers[i].amount,
            "unexpected amount"
          );
        }
      }
    } else {
      assert.equal(
        newTransferEvents.length,
        0,
        "unexpected number of transfer events"
      );
    }
  }

  public encodeBridgeOperation(bridgeOperation: BridgeOperation) {
    return web3.eth.abi.encodeParameters(
      [
        {
          components: [
            {
              components: [
                {
                  internalType: "uint256",
                  name: "batchID",
                  type: "uint256"
                },
                {
                  internalType: "uint96[]",
                  name: "amounts",
                  type: "uint96[]"
                }
              ],
              internalType: "struct Bridge.DepositBatch[]",
              name: "transferBatches",
              type: "tuple[]"
            },
            {
              components: [
                {
                  internalType: "address",
                  name: "connector",
                  type: "address"
                },
                {
                  internalType: "uint256",
                  name: "gasLimit",
                  type: "uint256"
                },
                {
                  components: [
                    {
                      internalType: "bytes",
                      name: "groupData",
                      type: "bytes"
                    },
                    {
                      components: [
                        {
                          internalType: "address",
                          name: "owner",
                          type: "address"
                        },
                        {
                          internalType: "address",
                          name: "token",
                          type: "address"
                        },
                        {
                          internalType: "uint96",
                          name: "amount",
                          type: "uint96"
                        },
                        {
                          internalType: "bytes",
                          name: "userData",
                          type: "bytes"
                        },
                        {
                          internalType: "uint256",
                          name: "minGas",
                          type: "uint256"
                        },
                        {
                          internalType: "uint256",
                          name: "maxFee",
                          type: "uint256"
                        },
                        {
                          internalType: "uint256",
                          name: "validUntil",
                          type: "uint256"
                        }
                      ],
                      internalType: "struct ConnectorTx[]",
                      name: "transactions",
                      type: "tuple[]"
                    }
                  ],
                  internalType: "struct ConnectorTxGroup[]",
                  name: "txGroups",
                  type: "tuple[]"
                }
              ],
              internalType: "struct Bridge.ConnectorCall[]",
              name: "connectorCalls",
              type: "tuple[]"
            },
            {
              components: [
                {
                  internalType: "address",
                  name: "token",
                  type: "address"
                },
                {
                  internalType: "uint16",
                  name: "tokenID",
                  type: "uint16"
                },
                {
                  internalType: "uint256",
                  name: "amount",
                  type: "uint256"
                }
              ],
              internalType: "struct BatchDepositor.TokenData[]",
              name: "tokens",
              type: "tuple[]"
            }
          ],
          internalType: "struct Bridge.BridgeOperations",
          name: "operations",
          type: "tuple"
        }
      ],
      [bridgeOperation]
    );
  }
}

contract("Bridge", (accounts: string[]) => {
  let ctx: ExchangeTestUtil;

  let agentRegistry: any;
  let registryOwner: string;

  let swapper: any;
  let swappperBridgeConnectorA: any;
  let swappperBridgeConnectorB: any;

  let failingSwapper: any;
  let failingSwappperBridgeConnector: any;

  let migrationBridgeConnector: any;

  let rate: BN = new BN(web3.utils.toWei("1", "ether"));

  let ownerA: string;
  let ownerB: string;
  let ownerC: string;
  let ownerD: string;

  const setupBridge = async () => {
    const bridge = new Bridge(ctx);
    await bridge.setup();

    await agentRegistry.registerUniversalAgent(bridge.address, true, {
      from: registryOwner
    });

    swapper = await TestSwapper.new(rate, false);

    // Add some funds to the swapper contract
    for (const token of ["LRC", "WETH", "ETH"]) {
      await ctx.transferBalance(
        swapper.address,
        token,
        new BN(web3.utils.toWei("100", "ether"))
      );
    }

    swappperBridgeConnectorA = await TestSwappperBridgeConnector.new(
      swapper.address
    );
    swappperBridgeConnectorB = await TestSwappperBridgeConnector.new(
      swapper.address
    );

    failingSwapper = await TestSwapper.new(rate, true);

    failingSwappperBridgeConnector = await TestSwappperBridgeConnector.new(
      failingSwapper.address
    );

    migrationBridgeConnector = await TestMigrationBridgeConnector.new(
      ctx.exchange.address,
      bridge.address
    );

    bridge.setMigrationConnectorAddress(migrationBridgeConnector.address);

    return bridge;
  };

  const encodeSwapGroupSettings = (tokenIn: string, tokenOut: string) => {
    return web3.eth.abi.encodeParameter(
      {
        "struct GroupSettings": {
          tokenIn: "address",
          tokenOut: "address"
        }
      },
      {
        tokenIn: ctx.getTokenAddress(tokenIn),
        tokenOut: ctx.getTokenAddress(tokenOut)
      }
    );
  };

  const encodeSwapUserSettings = (minAmountOut: BN) => {
    return web3.eth.abi.encodeParameter(
      {
        "struct UserSettings": {
          minAmountOut: "uint"
        }
      },
      {
        minAmountOut: minAmountOut.toString(10)
      }
    );
  };

  const encodeMigrateGroupSettings = (token: string) => {
    return web3.eth.abi.encodeParameter(
      {
        "struct GroupSettings": {
          token: "address"
        }
      },
      {
        token: ctx.getTokenAddress(token)
      }
    );
  };

  const encodeMigrateUserSettings = (to: string) => {
    return web3.eth.abi.encodeParameter(
      {
        "struct UserSettings": {
          to: "address"
        }
      },
      {
        to: to
      }
    );
  };

  const round = (value: string) => {
    return roundToFloatValue(new BN(value), Constants.Float24Encoding).toString(
      10
    );
  };

  const convert = (amount: string) => {
    const RATE_BASE = new BN(web3.utils.toWei("1", "ether"));
    return new BN(amount)
      .mul(rate)
      .div(RATE_BASE)
      .toString(10);
  };

  const withdrawFromPendingBatchDepositsChecked = async (
    bridge: Bridge,
    depositID: number,
    transfers: InternalDeposit[],
    indices: number[]
  ) => {
    // Simulate all transfers
    const snapshot = new BalanceSnapshot(ctx);

    // Simulate withdrawals
    for (const idx of indices) {
      await snapshot.transfer(
        bridge.address,
        transfers[idx].owner,
        ctx.getTokenAddressFromID(transfers[idx].tokenID),
        new BN(transfers[idx].amount),
        "bridge",
        "owner"
      );
    }

    // Do the withdrawal
    await bridge.contract.withdrawFromPendingBatchDeposits(
      depositID,
      transfers,
      indices
    );

    // Verify balances
    await snapshot.verifyBalances();
  };

  before(async () => {
    ctx = new ExchangeTestUtil();
    await ctx.initialize(accounts);

    ctx.blockSizes.push(...[24, 32, 40, 48]);

    ownerA = ctx.testContext.orderOwners[12];
    ownerB = ctx.testContext.orderOwners[13];
    ownerC = ctx.testContext.orderOwners[14];
    ownerD = ctx.testContext.orderOwners[15];
  });

  after(async () => {
    await ctx.stop();
  });

  beforeEach(async () => {
    // Fresh Exchange for each test
    await ctx.createExchange(ctx.testContext.stateOwners[0], {
      setupTestState: true,
      deterministic: true
    });

    // Create the agent registry
    registryOwner = accounts[7];
    agentRegistry = await AgentRegistry.new({ from: registryOwner });

    // Register it on the exchange contract
    const wrapper = await ctx.contracts.ExchangeV3.at(ctx.operator.address);
    await wrapper.setAgentRegistry(agentRegistry.address, {
      from: ctx.exchangeOwner
    });
  });

  describe("Bridge", function() {
    this.timeout(0);

    it("Batch deposit", async () => {
      const bridge = await setupBridge();

      const depositsA: BridgeDeposit[] = [];
      depositsA.push({
        owner: ownerA,
        token: ctx.getTokenAddress("ETH"),
        amount: web3.utils.toWei("1", "ether")
      });
      depositsA.push({
        owner: ownerB,
        token: ctx.getTokenAddress("ETH"),
        amount: web3.utils.toWei("2.1265", "ether")
      });
      depositsA.push({
        owner: ownerB,
        token: ctx.getTokenAddress("LRC"),
        amount: web3.utils.toWei("26.2154454177", "ether")
      });
      depositsA.push({
        owner: ownerA,
        token: ctx.getTokenAddress("LRC"),
        amount: web3.utils.toWei("1028.2154454177", "ether")
      });
      depositsA.push({
        owner: ownerB,
        token: ctx.getTokenAddress("ETH"),
        amount: web3.utils.toWei("1.15484511245", "ether")
      });
      depositsA.push({
        owner: ownerB,
        token: ctx.getTokenAddress("LRC"),
        amount: web3.utils.toWei("12545.15484511245", "ether")
      });

      const depositsB: BridgeDeposit[] = [];
      depositsB.push({
        owner: ownerB,
        token: ctx.getTokenAddress("WETH"),
        amount: web3.utils.toWei("12.15484511245", "ether")
      });
      depositsB.push({
        owner: ownerB,
        token: ctx.getTokenAddress("ETH"),
        amount: web3.utils.toWei("1.15484511245", "ether")
      });
      depositsB.push({
        owner: ownerB,
        token: ctx.getTokenAddress("LRC"),
        amount: web3.utils.toWei("12545.15484511245", "ether")
      });
      depositsB.push({
        owner: ownerB,
        token: ctx.getTokenAddress("WETH"),
        amount: web3.utils.toWei("12.15484511245", "ether")
      });

      const transferEventsA = await bridge.batchDeposit(depositsA);
      const transferEventsB = await bridge.batchDeposit(depositsB);
      await bridge.submitBridgeOperation(
        [...transferEventsA, ...transferEventsB],
        []
      );

      const depositsC: BridgeDeposit[] = [];
      depositsC.push({
        owner: ownerB,
        token: ctx.getTokenAddress("WETH"),
        amount: web3.utils.toWei("1", "ether")
      });
      depositsC.push({
        owner: ownerB,
        token: ctx.getTokenAddress("ETH"),
        amount: web3.utils.toWei("2", "ether")
      });
      depositsC.push({
        owner: ownerB,
        token: ctx.getTokenAddress("LRC"),
        amount: web3.utils.toWei("3", "ether")
      });
      const transferEventsC = await bridge.batchDeposit(depositsC);
      // Try to different transfers
      await expectThrow(
        bridge.submitBridgeOperation(transferEventsC, [], undefined, true),
        "UNKNOWN_TRANSFERS"
      );
    });

    it("Bridge calls", async () => {
      const bridge = await setupBridge();

      await bridge.contract.trustConnector(
        swappperBridgeConnectorA.address,
        true
      );
      await bridge.contract.trustConnector(
        swappperBridgeConnectorB.address,
        true
      );
      await bridge.contract.trustConnector(
        failingSwappperBridgeConnector.address,
        true
      );
      await bridge.contract.trustConnector(
        migrationBridgeConnector.address,
        true
      );

      const group_ETH_LRC = encodeSwapGroupSettings("ETH", "LRC");
      const group_LRC_ETH = encodeSwapGroupSettings("LRC", "ETH");
      const group_WETH_LRC = encodeSwapGroupSettings("WETH", "LRC");

      const calls: ConnectorTx[] = [];
      // Successful swap connector call
      // ETH -> LRC
      calls.push({
        owner: ownerA,
        token: "ETH",
        amount: round(web3.utils.toWei("1.0132", "ether")),
        feeToken: "ETH",
        maxFee: "0",
        minGas: 30000,
        userData: "0x",
        validUntil: 0,
        connector: swappperBridgeConnectorA.address,
        groupData: group_ETH_LRC,
        expectedDeposit: {
          owner: ownerA,
          token: "LRC",
          amount: convert(round(web3.utils.toWei("1.0132", "ether")))
        }
      });
      calls.push({
        owner: ownerB,
        token: "ETH",
        amount: round(web3.utils.toWei("2.0456546565", "ether")),
        feeToken: "ETH",
        maxFee: "0",
        minGas: 30000,
        userData: encodeSwapUserSettings(
          new BN(web3.utils.toWei("2", "ether"))
        ),
        validUntil: 0,
        connector: swappperBridgeConnectorA.address,
        groupData: group_ETH_LRC,
        expectedDeposit: {
          owner: ownerB,
          token: "LRC",
          amount: convert(round(web3.utils.toWei("2.0456546565", "ether")))
        }
      });
      calls.push({
        owner: ownerC,
        token: "ETH",
        amount: round(web3.utils.toWei("3.458415454541", "ether")),
        feeToken: "ETH",
        maxFee: "0",
        minGas: 30000,
        userData: encodeSwapUserSettings(
          new BN(web3.utils.toWei("3.5", "ether"))
        ),
        validUntil: 0,
        connector: swappperBridgeConnectorA.address,
        groupData: group_ETH_LRC,
        expectedDeposit: {
          owner: ownerC,
          token: "ETH",
          amount: convert(round(web3.utils.toWei("3.458415454541", "ether")))
        }
      });
      // WETH -> LRC
      calls.push({
        owner: ownerC,
        token: "WETH",
        amount: round(web3.utils.toWei("6.458415454541", "ether")),
        feeToken: "LRC",
        maxFee: "0",
        minGas: 30000,
        userData: encodeSwapUserSettings(
          new BN(web3.utils.toWei("3.5", "ether"))
        ),
        validUntil: 0,
        connector: swappperBridgeConnectorA.address,
        groupData: group_WETH_LRC,
        expectedDeposit: {
          owner: ownerC,
          token: "LRC",
          amount: convert(round(web3.utils.toWei("6.458415454541", "ether")))
        }
      });

      // Different swapper
      calls.push({
        owner: ownerD,
        token: "ETH",
        amount: round(web3.utils.toWei("1.458415454541", "ether")),
        feeToken: "ETH",
        maxFee: "0",
        minGas: 30000,
        userData: encodeSwapUserSettings(
          new BN(web3.utils.toWei("1", "ether"))
        ),
        validUntil: 0,
        connector: swappperBridgeConnectorB.address,
        groupData: group_ETH_LRC,
        expectedDeposit: {
          owner: ownerD,
          token: "LRC",
          amount: convert(round(web3.utils.toWei("1.458415454541", "ether")))
        }
      });
      calls.push({
        owner: ownerA,
        token: "ETH",
        amount: round(web3.utils.toWei("1.0132", "ether")),
        feeToken: "ETH",
        maxFee: "0",
        minGas: 30000,
        userData: "0x",
        validUntil: 0,
        connector: swappperBridgeConnectorB.address,
        groupData: group_ETH_LRC,
        expectedDeposit: {
          owner: ownerA,
          token: "LRC",
          amount: convert(round(web3.utils.toWei("1.0132", "ether")))
        }
      });

      // Unsuccessful swap connector call
      calls.push({
        owner: ownerA,
        token: "ETH",
        amount: round(web3.utils.toWei("1.0132", "ether")),
        feeToken: "ETH",
        maxFee: "0",
        minGas: 30000,
        userData: "0x",
        validUntil: 0,
        connector: failingSwappperBridgeConnector.address,
        groupData: group_ETH_LRC,
        expectedDeposit: {
          owner: ownerA,
          token: "ETH",
          amount: round(web3.utils.toWei("1.0132", "ether"))
        }
      });
      calls.push({
        owner: ownerB,
        token: "ETH",
        amount: round(web3.utils.toWei("2.0456546565", "ether")),
        feeToken: "ETH",
        maxFee: "0",
        minGas: 30000,
        userData: encodeSwapUserSettings(
          new BN(web3.utils.toWei("2", "ether"))
        ),
        validUntil: 0,
        connector: failingSwappperBridgeConnector.address,
        groupData: group_ETH_LRC,
        expectedDeposit: {
          owner: ownerB,
          token: "ETH",
          amount: round(web3.utils.toWei("2.0456546565", "ether"))
        }
      });
      calls.push({
        owner: ownerB,
        token: "LRC",
        amount: round(web3.utils.toWei("12.458415454541", "ether")),
        feeToken: "LRC",
        maxFee: "0",
        minGas: 30000,
        userData: encodeSwapUserSettings(
          new BN(web3.utils.toWei("1", "ether"))
        ),
        validUntil: 0xffffffff,
        connector: failingSwappperBridgeConnector.address,
        groupData: group_LRC_ETH,
        expectedDeposit: {
          owner: ownerB,
          token: "LRC",
          amount: round(web3.utils.toWei("12.458415454541", "ether"))
        }
      });
      calls.push({
        owner: ownerC,
        token: "WETH",
        amount: round(web3.utils.toWei("12.458415454541", "ether")),
        feeToken: "WETH",
        maxFee: "0",
        minGas: 30000,
        userData: encodeSwapUserSettings(
          new BN(web3.utils.toWei("1", "ether"))
        ),
        validUntil: 0xffffffff,
        connector: failingSwappperBridgeConnector.address,
        groupData: group_WETH_LRC,
        expectedDeposit: {
          owner: ownerC,
          token: "WETH",
          amount: round(web3.utils.toWei("12.458415454541", "ether"))
        }
      });

      // Migrate
      calls.push({
        owner: ownerA,
        token: "ETH",
        amount: round(web3.utils.toWei("1.0132", "ether")),
        feeToken: "ETH",
        maxFee: "0",
        minGas: 30000,
        userData: "0x",
        validUntil: 0,
        connector: migrationBridgeConnector.address,
        groupData: encodeMigrateGroupSettings("ETH"),
        expectedDeposit: {
          owner: ownerA,
          token: "ETH",
          amount: round(web3.utils.toWei("1.0132", "ether"))
        }
      });
      calls.push({
        owner: ownerB,
        token: "ETH",
        amount: round(web3.utils.toWei("10.132", "ether")),
        feeToken: "ETH",
        maxFee: "0",
        minGas: 30000,
        userData: encodeMigrateUserSettings(ownerA),
        validUntil: 0,
        connector: migrationBridgeConnector.address,
        groupData: encodeMigrateGroupSettings("ETH"),
        expectedDeposit: {
          owner: ownerA,
          token: "ETH",
          amount: round(web3.utils.toWei("10.132", "ether"))
        }
      });
      calls.push({
        owner: ownerB,
        token: "LRC",
        amount: round(web3.utils.toWei("123.3132", "ether")),
        feeToken: "ETH",
        maxFee: "0",
        minGas: 30000,
        userData: encodeMigrateUserSettings(ownerB),
        validUntil: 0,
        connector: migrationBridgeConnector.address,
        groupData: encodeMigrateGroupSettings("LRC"),
        expectedDeposit: {
          owner: ownerB,
          token: "LRC",
          amount: round(web3.utils.toWei("123.3132", "ether"))
        }
      });
      calls.push({
        owner: ownerB,
        token: "LRC",
        amount: round(web3.utils.toWei("1234.1132", "ether")),
        feeToken: "ETH",
        maxFee: "0",
        minGas: 30000,
        userData: encodeMigrateUserSettings(ownerD),
        validUntil: 0,
        connector: migrationBridgeConnector.address,
        groupData: encodeMigrateGroupSettings("LRC"),
        expectedDeposit: {
          owner: ownerD,
          token: "LRC",
          amount: round(web3.utils.toWei("1234.1132", "ether"))
        }
      });

      await bridge.setupCalls(calls);
      await bridge.submitBridgeOperation([], calls, [true, true, false, true]);

      // Handle resulting batched deposits
      const depositEvents = await ctx.getEvents(
        ctx.exchange,
        "DepositRequested"
      );
      for (const deposit of depositEvents) {
        await ctx.requestDeposit(
          bridge.address,
          deposit.token,
          new BN(deposit.amount)
        );
      }
      const transferEvents = await ctx.getEvents(
        bridge.contract,
        "BatchDeposited"
      );
      await bridge.submitBridgeOperation(transferEvents, []);
    });

    it("Manual withdrawal", async () => {
      const bridge = await setupBridge();

      const deposits: BridgeDeposit[] = [];
      deposits.push({
        owner: ownerA,
        token: ctx.getTokenAddress("ETH"),
        amount: web3.utils.toWei("1", "ether")
      });
      deposits.push({
        owner: ownerB,
        token: ctx.getTokenAddress("ETH"),
        amount: web3.utils.toWei("1", "ether")
      });
      deposits.push({
        owner: ownerB,
        token: ctx.getTokenAddress("LRC"),
        amount: web3.utils.toWei("1", "ether")
      });
      deposits.push({
        owner: ownerA,
        token: ctx.getTokenAddress("LRC"),
        amount: web3.utils.toWei("1", "ether")
      });
      deposits.push({
        owner: ownerB,
        token: ctx.getTokenAddress("ETH"),
        amount: web3.utils.toWei("1", "ether")
      });
      deposits.push({
        owner: ownerB,
        token: ctx.getTokenAddress("WETH"),
        amount: web3.utils.toWei("1", "ether")
      });

      const transferEvents = await bridge.batchDeposit(deposits);

      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();

      const withdrawalFee = await ctx.loopringV3.forcedWithdrawalFee();
      await bridge.contract.forceWithdraw(
        [ctx.getTokenAddress("ETH"), ctx.getTokenAddress("LRC")],
        {
          value: withdrawalFee.mul(new BN(2))
        }
      );

      await ctx.requestWithdrawal(
        bridge.address,
        "ETH",
        new BN(web3.utils.toWei("3", "ether")),
        "ETH",
        new BN(0),
        {
          authMethod: AuthMethod.FORCE,
          skipForcedAuthentication: true
        }
      );

      await ctx.requestWithdrawal(
        bridge.address,
        "LRC",
        new BN(web3.utils.toWei("2", "ether")),
        "ETH",
        new BN(0),
        {
          authMethod: AuthMethod.FORCE,
          skipForcedAuthentication: true
        }
      );

      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();

      const transfers = bridge.decodeTransfers(transferEvents[0].transfersData);

      await expectThrow(
        bridge.contract.withdrawFromPendingBatchDeposits(0, transfers, [1]),
        "BATCH_DEPOSITS_STILL_YOUNG"
      );

      const MAX_AGE_PENDING_DEPOSITS = (
        await bridge.contract.MAX_AGE_PENDING_DEPOSITS()
      ).toNumber();
      await ctx.advanceBlockTimestamp(MAX_AGE_PENDING_DEPOSITS + 1);

      await withdrawFromPendingBatchDepositsChecked(bridge, 0, transfers, [
        1,
        3
      ]);

      await withdrawFromPendingBatchDepositsChecked(bridge, 0, transfers, [0]);

      await expectThrow(
        bridge.contract.withdrawFromPendingBatchDeposits(0, transfers, [1, 2]),
        "ALREADY_WITHDRAWN"
      );
    });

    it("Benchmark", async () => {
      const bridge = await setupBridge();

      await bridge.contract.trustConnector(
        swappperBridgeConnectorA.address,
        true
      );

      const group_ETH_LRC = encodeSwapGroupSettings("ETH", "LRC");

      const calls: ConnectorTx[] = [];
      for (let i = 0; i < 5; i++) {
        calls.push({
          owner: ownerA,
          token: "ETH",
          amount: round(web3.utils.toWei("1.0132", "ether")),
          feeToken: "ETH",
          maxFee: "0",
          minGas: 30000,
          userData: "0x",
          validUntil: 0,
          connector: swappperBridgeConnectorA.address,
          groupData: group_ETH_LRC,
          expectedDeposit: {
            owner: ownerA,
            token: "LRC",
            amount: convert(round(web3.utils.toWei("1.0132", "ether")))
          }
        });
      }

      await bridge.setupCalls(calls);
      await bridge.submitBridgeOperation([], calls, [true]);
    });
  });
});
