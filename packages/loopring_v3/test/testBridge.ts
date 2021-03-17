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

const AgentRegistry = artifacts.require("AgentRegistry");

const BridgeContract = artifacts.require("Bridge");
const TestSwapper = artifacts.require("TestSwapper");
const TestSwappperBridgeConnector = artifacts.require(
  "TestSwappperBridgeConnector"
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
}

export interface ConnectorGroup {
  groupData: string;
  calls: BridgeCall[];
}

export interface ConnectorCalls {
  connector: string;
  gasLimit: number;
  totalMinGas: number;
  groups: ConnectorGroup[];
  tokens: TokenData[];
}

export interface TransferOperation {
  batchID: number;
  transfers: InternalBridgeTransfer[];
}

export interface BridgeOperations {
  transferOperations: TransferOperation[];
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
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "tokenID", type: "uint16" },
          { name: "amount", type: "uint96" },
          { name: "feeTokenID", type: "uint16" },
          { name: "maxFee", type: "uint96" },
          { name: "storageID", type: "uint32" },
          { name: "minGas", type: "uint32" },
          { name: "connector", type: "address" },
          { name: "groupData", type: "bytes" },
          { name: "userData", type: "bytes" },
          { name: "validUntil", type: "uint256" }
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
        from: callWrapper.transfer.from,
        to: callWrapper.transfer.to,
        tokenID: callWrapper.transfer.tokenID,
        amount: callWrapper.transfer.amount,
        feeTokenID: callWrapper.transfer.feeTokenID,
        maxFee: callWrapper.call.maxFee,
        storageID: callWrapper.transfer.storageID,
        minGas: callWrapper.call.minGas,
        connector: callWrapper.connector,
        groupData: callWrapper.groupData,
        userData: callWrapper.call.userData,
        validUntil: callWrapper.call.validUntil
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

    const tx = await this.contract.batchDeposit(this.relayer, deposits, {
      from: this.relayer,
      value: ethValue
    });
    console.log(
      "\x1b[46m%s\x1b[0m",
      "[BatchDeposit] Gas used: " + tx.receipt.gasUsed
    );
    const event = await this.ctx.assertEventEmitted(this.contract, "Transfers");

    const depositEvents = await this.ctx.assertEventsEmitted(
      this.ctx.exchange,
      "DepositRequested",
      3
    );

    // Process the deposits
    for (const [token, amount] of tokens.entries()) {
      await this.ctx.requestDeposit(this.address, token, amount);
    }

    await this.ctx.submitTransactions();
    await this.ctx.submitPendingBlocks();

    const blockCallback = this.ctx.addBlockCallback(this.address);

    for (const deposit of deposits) {
      await this.ctx.transfer(
        this.address,
        deposit.owner,
        deposit.token,
        new BN(deposit.amount),
        deposit.token,
        new BN(0),
        {
          authMethod: AuthMethod.NONE,
          amountToDeposit: new BN(0),
          feeToDeposit: new BN(0),
          transferToNew: true
        }
      );
    }

    const transfers: InternalBridgeTransfer[] = [];
    for (const deposit of deposits) {
      transfers.push({
        owner: deposit.owner,
        tokenID: await this.ctx.getTokenID(deposit.token),
        amount: deposit.amount
      });
    }

    const bridgeOperations: BridgeOperations = {
      transferOperations: [{ batchID: event.batchID.toNumber(), transfers }],
      connectorCalls: [],
      tokens: []
    };

    // Set the pool transaction data on the callback
    blockCallback.auxiliaryData = this.encodeBridgeOperations(bridgeOperations);
    blockCallback.numTxs = deposits.length;

    await this.ctx.submitTransactions();
    await this.ctx.submitPendingBlocks();
  }

  public async submitCalls(calls: BridgeCall[]) {
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

    const bridgeOperations: BridgeOperations = {
      transferOperations: [],
      connectorCalls: [],
      tokens: []
    };

    for (const [token, amount] of tokenMap.entries()) {
      bridgeOperations.tokens.push({
        token: token,
        tokenID: await this.ctx.getTokenID(token),
        amount: amount.toString(10)
      });
    }

    // Sor the calls on connector and group
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
          gasLimit: 1000000,
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

    const blockCallback = this.ctx.addBlockCallback(this.address);

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

    await this.ctx.submitTransactions();
    await this.ctx.submitPendingBlocks();

    await this.ctx.assertEventEmitted(this.contract, "BridgeCallSuccess");
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
  let testSwappperBridgeConnector: any;

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

    swapper = await TestSwapper.new(rate);

    // Add some funds to the swapper contract
    for (const token of ["LRC", "WETH", "ETH"]) {
      await ctx.transferBalance(
        swapper.address,
        token,
        new BN(web3.utils.toWei("20", "ether"))
      );
    }

    testSwappperBridgeConnector = await TestSwappperBridgeConnector.new(
      ctx.exchange.address,
      swapper.address
    );

    return bridge;
  };

  const encodeGroupSettings = (tokenIn: string, tokenOut: string) => {
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

  const round = (value: string) => {
    return roundToFloatValue(new BN(value), Constants.Float24Encoding).toString(
      10
    );
  };

  before(async () => {
    ctx = new ExchangeTestUtil();
    await ctx.initialize(accounts);

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

      const deposits: BridgeTransfer[] = [];
      deposits.push({
        owner: ownerA,
        token: ctx.getTokenAddress("ETH"),
        amount: web3.utils.toWei("1", "ether")
      });
      deposits.push({
        owner: ownerB,
        token: ctx.getTokenAddress("ETH"),
        amount: web3.utils.toWei("2.1265", "ether")
      });
      deposits.push({
        owner: ownerB,
        token: ctx.getTokenAddress("LRC"),
        amount: web3.utils.toWei("26.2154454177", "ether")
      });
      deposits.push({
        owner: ownerA,
        token: ctx.getTokenAddress("LRC"),
        amount: web3.utils.toWei("1028.2154454177", "ether")
      });
      deposits.push({
        owner: ownerB,
        token: ctx.getTokenAddress("ETH"),
        amount: web3.utils.toWei("1.15484511245", "ether")
      });
      deposits.push({
        owner: ownerB,
        token: ctx.getTokenAddress("LRC"),
        amount: web3.utils.toWei("12545.15484511245", "ether")
      });
      deposits.push({
        owner: ownerB,
        token: ctx.getTokenAddress("WETH"),
        amount: web3.utils.toWei("12.15484511245", "ether")
      });

      await bridge.batchDeposit(deposits);
    });

    it.only("Batch call", async () => {
      const bridge = await setupBridge();

      await bridge.contract.setConnectorTrusted(
        testSwappperBridgeConnector.address,
        true
      );

      const group_ETH_LRC = encodeGroupSettings("ETH", "LRC");
      const group_LRC_ETH = encodeGroupSettings("LRC", "ETH");
      const group_WETH_LRC = encodeGroupSettings("WETH", "LRC");

      const calls: BridgeCall[] = [];
      calls.push({
        owner: ownerA,
        token: "ETH",
        amount: round(web3.utils.toWei("1.0132", "ether")),
        feeToken: "ETH",
        maxFee: "0",
        minGas: 30000,
        userData: "0x",
        validUntil: 0xffffffff,
        connector: testSwappperBridgeConnector.address,
        groupData: group_ETH_LRC
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
        validUntil: 0xffffffff,
        connector: testSwappperBridgeConnector.address,
        groupData: group_ETH_LRC
      });
      calls.push({
        owner: ownerC,
        token: "ETH",
        amount: round(web3.utils.toWei("3.458415454541", "ether")),
        feeToken: "ETH",
        maxFee: "0",
        minGas: 30000,
        userData: encodeSwapUserSettings(
          new BN(web3.utils.toWei("4", "ether"))
        ),
        validUntil: 0xffffffff,
        connector: testSwappperBridgeConnector.address,
        groupData: group_ETH_LRC
      });
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
        validUntil: 0xffffffff,
        connector: testSwappperBridgeConnector.address,
        groupData: group_ETH_LRC
      });

      calls.push({
        owner: ownerB,
        token: "LRC",
        amount: round(web3.utils.toWei("1.458415454541", "ether")),
        feeToken: "LRC",
        maxFee: "0",
        minGas: 30000,
        userData: encodeSwapUserSettings(
          new BN(web3.utils.toWei("1", "ether"))
        ),
        validUntil: 0xffffffff,
        connector: testSwappperBridgeConnector.address,
        groupData: group_LRC_ETH
      });

      calls.push({
        owner: ownerB,
        token: "WETH",
        amount: round(web3.utils.toWei("1.458415454541", "ether")),
        feeToken: "WETH",
        maxFee: "0",
        minGas: 30000,
        userData: encodeSwapUserSettings(
          new BN(web3.utils.toWei("1", "ether"))
        ),
        validUntil: 0xffffffff,
        connector: testSwappperBridgeConnector.address,
        groupData: group_WETH_LRC
      });

      await bridge.submitCalls(calls);

      assert(false);
    });
  });
});
