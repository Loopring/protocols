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

const AgentRegistry = artifacts.require("AgentRegistry");

const BridgeContract = artifacts.require("Bridge");
const TestSwapper = artifacts.require("TestSwapper");
const TestSwappperBridgeConnector = artifacts.require(
  "TestSwappperBridgeConnector"
);
const TestMigrationBridgeConnector = artifacts.require(
  "TestMigrationBridgeConnector"
);

export interface BridgeTransfer {
  owner: string;
  token: string;
  amount: string;
}

export interface InternalBridgeTransfer {
  owner: string;
  tokenID: number;
  amount: string;
}

export interface TokenData {
  token: string;
  tokenID: number;
  amount: string;
}

export interface BridgeCall {
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
  expectedDeposit?: BridgeTransfer;
}

export interface ConnectorGroup {
  groupData: string;
  calls: BridgeCall[];
}

export interface ConnectorCalls {
  connector: string;
  gasLimit: number;
  groups: ConnectorGroup[];
  totalMinGas: number;
  tokens: TokenData[];
}

export interface TransferBatch {
  batchID: number;
  amounts: string[];
}

export interface BridgeOperations {
  transferBatches: TransferBatch[];
  connectorCalls: ConnectorCalls[];
  tokens: TokenData[];
}

export interface BridgeCallWrapper {
  transfer: Transfer;
  connector: string;
  groupData: string;
  call: BridgeCall;
}

export namespace CollectTransferUtils {
  export function toTypedData(
    callWrapper: BridgeCallWrapper,
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
        BridgeCall: [
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
      primaryType: "BridgeCall",
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
        maxFee: callWrapper.call.maxFee,
        validUntil: callWrapper.call.validUntil,
        storageID: callWrapper.transfer.storageID,
        minGas: callWrapper.call.minGas,
        connector: callWrapper.connector,
        groupData: callWrapper.groupData,
        userData: callWrapper.call.userData
      }
    };
    return typedData;
  }

  export function getHash(
    callWrapper: BridgeCallWrapper,
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

    //console.log(this.contract);
    //console.log(this.contract.contract);
    //console.log(this.contract.contract.methods);

    this.address = this.contract.address;
  }

  public async setMigrationConnectorAddress(migrationConnector: string) {
    this.migrationConnector = migrationConnector;
  }

  public async batchDeposit(deposits: BridgeTransfer[]) {
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
    console.log(
      "\x1b[46m%s\x1b[0m",
      "[BatchDeposit] Gas used: " + tx.receipt.gasUsed
    );
    const transferEvents = await this.ctx.getEvents(this.contract, "Transfers");

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

  public async setupCalls(calls: BridgeCall[]) {
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
    const transfers: InternalBridgeTransfer[] = [];
    const data = new Bitstream(_data);
    for (let i = 0; i < data.length() / 34; i++) {
      const transfer: InternalBridgeTransfer = {
        owner: data.extractAddress(i * 34 + 0),
        tokenID: data.extractUint16(i * 34 + 32),
        amount: data.extractUint96(i * 34 + 20).toString(10)
      };
      transfers.push(transfer);
    }
    return transfers;
  }

  public async submitBridgeOperations(
    transferEvents: any[],
    calls: BridgeCall[],
    expectedSuccess?: boolean[],
    changeTransfers?: boolean
  ) {
    changeTransfers = changeTransfers ? true : false;
    console.log("Change transfers: " + changeTransfers);

    const bridgeOperations: BridgeOperations = {
      transferBatches: [],
      connectorCalls: [],
      tokens: []
    };

    const blockCallback = this.ctx.addBlockCallback(this.address);

    for (const event of transferEvents) {
      const amounts: string[] = [];
      const transfers = this.decodeTransfers(event.transfers);
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
      bridgeOperations.transferBatches.push({
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
      bridgeOperations.tokens.push({
        token: token,
        tokenID: await this.ctx.getTokenID(token),
        amount: amount.toString(10)
      });
    }

    // Sort the calls on connector and group
    for (const call of calls) {
      let connectorCalls: ConnectorCalls;
      for (let c = 0; c < bridgeOperations.connectorCalls.length; c++) {
        if (bridgeOperations.connectorCalls[c].connector === call.connector) {
          connectorCalls = bridgeOperations.connectorCalls[c];
          break;
        }
      }
      if (connectorCalls === undefined) {
        const connectorTokens: TokenData[] = [];
        for (const tokenData of bridgeOperations.tokens) {
          connectorTokens.push({
            token: tokenData.token,
            tokenID: tokenData.tokenID,
            amount: "0"
          });
        }
        connectorCalls = {
          connector: call.connector,
          gasLimit: 2000000,
          totalMinGas: 0,
          groups: [],
          tokens: connectorTokens
        };
        bridgeOperations.connectorCalls.push(connectorCalls);
      }

      let group: ConnectorGroup;
      for (let g = 0; g < connectorCalls.groups.length; g++) {
        if (connectorCalls.groups[g].groupData === call.groupData) {
          group = connectorCalls.groups[g];
          break;
        }
      }
      if (group === undefined) {
        group = {
          groupData: call.groupData,
          calls: []
        };
        connectorCalls.groups.push(group);
      }
      group.calls.push(call);

      let tokenData: TokenData;
      for (let t = 0; t < connectorCalls.tokens.length; t++) {
        if (connectorCalls.tokens[t].token === call.token) {
          tokenData = connectorCalls.tokens[t];
          break;
        }
      }
      assert(tokenData !== undefined, "invalid state");
      tokenData.amount = new BN(tokenData.amount)
        .add(new BN(call.amount))
        .toString(10);

      connectorCalls.totalMinGas += call.minGas;
    }

    //
    // Do L2 transactions
    //

    for (const connectorCalls of bridgeOperations.connectorCalls) {
      for (const group of connectorCalls.groups) {
        for (const call of group.calls) {
          const transfer = await this.ctx.transfer(
            call.owner,
            this.address,
            call.token,
            new BN(call.amount),
            call.feeToken,
            new BN(0),
            {
              authMethod: AuthMethod.NONE,
              amountToDeposit: new BN(0),
              feeToDeposit: new BN(0)
            }
          );

          const bridgeCallWrapper: BridgeCallWrapper = {
            transfer,
            call,
            connector: connectorCalls.connector,
            groupData: group.groupData
          };
          const txHash = CollectTransferUtils.getHash(
            bridgeCallWrapper,
            this.address
          );
          await this.ctx.requestSignatureVerification(
            call.owner,
            this.ctx.hashToFieldElement("0x" + txHash.toString("hex"))
          );
        }
      }
    }

    for (const token of bridgeOperations.tokens) {
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

    //console.log(bridgeOperations);

    // Set the pool transaction data on the callback
    blockCallback.auxiliaryData = this.encodeBridgeOperations(bridgeOperations);
    blockCallback.numTxs = calls.length * 2 + bridgeOperations.tokens.length;
    for (const batch of bridgeOperations.transferBatches) {
      blockCallback.numTxs += batch.amounts.length;
    }

    //console.log("Bridge Data:");
    //console.log(blockCallback.auxiliaryData);

    await this.ctx.submitTransactions();
    await this.ctx.submitPendingBlocks();

    const connectorCallResultEvents = await this.ctx.assertEventsEmitted(
      this.contract,
      "ConnectorCallResult",
      bridgeOperations.connectorCalls.length
    );

    if (expectedSuccess === undefined) {
      expectedSuccess = new Array(bridgeOperations.connectorCalls.length).fill(
        true
      );
    }

    for (let i = 0; i < connectorCallResultEvents.length; i++) {
      assert(
        bridgeOperations.connectorCalls[i].connector ===
          connectorCallResultEvents[i].connector,
        "unexpected success"
      );
      assert(
        expectedSuccess[i] === connectorCallResultEvents[i].success,
        "unexpected success"
      );
    }

    const expectedDepositTransfers: BridgeTransfer[] = [];
    const expectedMigrationTransfers: BridgeTransfer[] = [];
    for (const calls of bridgeOperations.connectorCalls) {
      for (const group of calls.groups) {
        for (const call of group.calls) {
          if (call.expectedDeposit) {
            if (calls.connector === this.migrationConnector) {
              expectedMigrationTransfers.push(call.expectedDeposit);
            } else {
              expectedDepositTransfers.push(call.expectedDeposit);
            }
          }
        }
      }
    }

    const newTransferEvents = await this.ctx.getEvents(
      this.contract,
      "Transfers"
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
        const transfers = this.decodeTransfers(newTransferEvents[c].transfers);
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

  public encodeBridgeOperations(bridgeOperations: BridgeOperations) {
    //console.log(bridgeOperations);

    const data = this.contract.contract.methods
      .encode(bridgeOperations)
      .encodeABI();

    //console.log(data);

    return "0x" + data.slice(2 + (4 + 0) * 2);

    /*const encodedDeposits = web3.eth.abi.encodeParameter(
     {
       "struct BridgeTransfer[]": {
         owner: "address",
         token: "address",
         amount: "uint96"
       }
     },
     bridgeOperations.transfers
   );*/

    /*const encodedBridgeOperations = web3.eth.abi.encodeParameter(
      {
        "BridgeConfig": {
          "BridgeTransfer[]": {
            owner: "address",
            token: "address",
            amount: "uint96"
          },
          "struct ConnectorCalls[]": {
            connector: "address",
            "struct ConnectorGroup[]": {
              groupData: "bytes",
              "struct BridgeCall[]": {
                owner: "address",
                token: "address",
                amount: "uint256",
                minGas: "uint256",
                maxFee: "uint256",
                userData: "bytes"
              }
            },
            "struct TokenData[]": {
              token: "address",
              tokenID: "uint16",
              amount: "uint256"
            }
          },
          "struct TokenData[]": {
            token: "address",
            tokenID: "uint16",
            amount: "uint256"
          }
        }
      },
      {
        "BridgeTransfer[]": bridgeOperations.transfers
      }
    );
    return encodedBridgeOperations;*/
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

  const withdrawFromPendingBatchDepositChecked = async (
    bridge: Bridge,
    depositID: number,
    transfers: InternalBridgeTransfer[],
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
    await bridge.contract.withdrawFromPendingBatchDeposit(
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

      const depositsA: BridgeTransfer[] = [];
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

      const depositsB: BridgeTransfer[] = [];
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
      await bridge.submitBridgeOperations(
        [...transferEventsA, ...transferEventsB],
        []
      );

      const depositsC: BridgeTransfer[] = [];
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
        bridge.submitBridgeOperations(transferEventsC, [], undefined, true),
        "UNKNOWN_TRANSFERS"
      );
    });

    it("Bridge calls", async () => {
      const bridge = await setupBridge();

      await bridge.contract.setConnectorTrusted(
        swappperBridgeConnectorA.address,
        true
      );
      await bridge.contract.setConnectorTrusted(
        swappperBridgeConnectorB.address,
        true
      );
      await bridge.contract.setConnectorTrusted(
        failingSwappperBridgeConnector.address,
        true
      );
      await bridge.contract.setConnectorTrusted(
        migrationBridgeConnector.address,
        true
      );

      const group_ETH_LRC = encodeSwapGroupSettings("ETH", "LRC");
      const group_LRC_ETH = encodeSwapGroupSettings("LRC", "ETH");
      const group_WETH_LRC = encodeSwapGroupSettings("WETH", "LRC");

      const calls: BridgeCall[] = [];
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
      await bridge.submitBridgeOperations([], calls, [true, true, false, true]);

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
      const transferEvents = await ctx.getEvents(bridge.contract, "Transfers");
      await bridge.submitBridgeOperations(transferEvents, []);

      // assert(false);
    });

    it("Manual withdrawal", async () => {
      const bridge = await setupBridge();

      const deposits: BridgeTransfer[] = [];
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

      const transfers = bridge.decodeTransfers(transferEvents[0].transfers);

      await expectThrow(
        bridge.contract.withdrawFromPendingBatchDeposit(0, transfers, [1]),
        "TRANSFERS_NOT_TOO_OLD"
      );

      const MAX_AGE_PENDING_TRANSFER = (
        await bridge.contract.MAX_AGE_PENDING_TRANSFER()
      ).toNumber();
      await ctx.advanceBlockTimestamp(MAX_AGE_PENDING_TRANSFER + 1);

      await withdrawFromPendingBatchDepositChecked(bridge, 0, transfers, [
        1,
        3
      ]);

      await withdrawFromPendingBatchDepositChecked(bridge, 0, transfers, [0]);

      await expectThrow(
        bridge.contract.withdrawFromPendingBatchDeposit(0, transfers, [1, 2]),
        "ALREADY_WITHDRAWN"
      );
    });
  });
});
