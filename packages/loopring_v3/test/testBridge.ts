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
  userData: string;
  minGas: number;
  maxFee: string;
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

  constructor(ctx: ExchangeTestUtil) {
    this.ctx = ctx;
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
}

contract("Bridge", (accounts: string[]) => {
  let ctx: ExchangeTestUtil;

  let agentRegistry: any;
  let registryOwner: string;

  let swapper: any;
  let testSwappperBridgeConnector: any;

  let tokenIn: string = "ETH";
  let tokenOut: string = "LRC";
  let rate: BN = new BN(web3.utils.toWei("1", "ether"));

  const amountIn = new BN(web3.utils.toWei("10", "ether"));
  const tradeAmountInA = amountIn.div(new BN(4));
  const tradeAmountInB = amountIn.div(new BN(4)).mul(new BN(3));

  let relayer: string;
  let ownerA: string;
  let ownerB: string;
  let ownerC: string;

  const setupBridge = async () => {
    const bridge = new Bridge(ctx);
    await bridge.setup();

    await agentRegistry.registerUniversalAgent(bridge.address, true, {
      from: registryOwner
    });

    swapper = await TestSwapper.new(
      ctx.getTokenAddress(tokenIn),
      ctx.getTokenAddress(tokenOut),
      rate
    );

    await ctx.transferBalance(
      swapper.address,
      tokenOut,
      new BN(web3.utils.toWei("20", "ether"))
    );

    testSwappperBridgeConnector = await TestSwappperBridgeConnector.new(
      ctx.exchange.address,
      swapper.address
    );

    return bridge;
  };

  const encodeTransfers = (transfers: BridgeTransfer[]) => {
    return web3.eth.abi.encodeParameter(
      {
        "struct BridgeTransfer[]": {
          owner: "address",
          token: "address",
          amount: "uint96"
        }
      },
      transfers
    );
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

  const encodeUserSettings = (minAmountOut: BN) => {
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

  const encodeBridgeOperations = (
    bridge: Bridge,
    bridgeOperations: BridgeOperations
  ) => {
    //console.log(bridgeOperations);

    const data = bridge.contract.contract.methods
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
  };

  const getOrderedDeposits = () => {
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
      token: ctx.getTokenAddress("WETH"),
      amount: web3.utils.toWei("12.15484511245", "ether")
    });
  };

  const round = (value: string) => {
    return roundToFloatValue(new BN(value), Constants.Float24Encoding).toString(
      10
    );
  };

  before(async () => {
    ctx = new ExchangeTestUtil();
    await ctx.initialize(accounts);

    relayer = ctx.testContext.orderOwners[11];
    ownerA = ctx.testContext.orderOwners[12];
    ownerB = ctx.testContext.orderOwners[13];
    ownerC = ctx.testContext.orderOwners[14];
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
          await ctx.setBalanceAndApprove(relayer, token, amount);
        }
      }

      const tx = await bridge.contract.batchDeposit(relayer, deposits, {
        from: relayer,
        value: ethValue
      });
      console.log(
        "\x1b[46m%s\x1b[0m",
        "[BatchDeposit] Gas used: " + tx.receipt.gasUsed
      );
      const event = await ctx.assertEventEmitted(bridge.contract, "Transfers");

      const depositEvents = await ctx.assertEventsEmitted(
        ctx.exchange,
        "DepositRequested",
        3
      );

      // Process the deposits
      for (const [token, amount] of tokens.entries()) {
        await ctx.requestDeposit(bridge.address, token, amount);
      }

      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();

      const blockCallback = ctx.addBlockCallback(bridge.address);

      for (const deposit of deposits) {
        await ctx.transfer(
          bridge.address,
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
          tokenID: await ctx.getTokenID(deposit.token),
          amount: deposit.amount
        });
      }

      const bridgeOperations: BridgeOperations = {
        transferOperations: [{ batchID: event.batchID.toNumber(), transfers }],
        connectorCalls: [],
        tokens: []
      };

      // Set the pool transaction data on the callback
      blockCallback.auxiliaryData = encodeBridgeOperations(
        bridge,
        bridgeOperations
      );
      blockCallback.numTxs = deposits.length;

      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();
    });

    it.only("Batch call", async () => {
      const bridge = await setupBridge();

      const groupSettings = encodeGroupSettings(tokenIn, tokenOut);

      const calls: BridgeCall[] = [];
      calls.push({
        owner: ownerA,
        token: Constants.zeroAddress,
        amount: round(web3.utils.toWei("1.0132", "ether")),
        minGas: 30000,
        maxFee: "0",
        userData: "0x",
        connector: testSwappperBridgeConnector.address,
        groupData: groupSettings
      });
      calls.push({
        owner: ownerB,
        token: Constants.zeroAddress,
        amount: round(web3.utils.toWei("2.0456546565", "ether")),
        minGas: 30000,
        maxFee: "0",
        userData: encodeUserSettings(new BN(web3.utils.toWei("2", "ether"))),
        connector: testSwappperBridgeConnector.address,
        groupData: groupSettings
      });
      calls.push({
        owner: ownerC,
        token: await ctx.getTokenAddress("ETH"),
        amount: round(web3.utils.toWei("3.458415454541", "ether")),
        minGas: 30000,
        maxFee: "0",
        userData: encodeUserSettings(new BN(web3.utils.toWei("4", "ether"))),
        connector: testSwappperBridgeConnector.address,
        groupData: groupSettings
      });

      for (const call of calls) {
        await ctx.deposit(
          call.owner,
          call.owner,
          call.token,
          new BN(call.amount)
        );
      }

      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();

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

      const tokens: TokenData[] = [];
      for (const [token, amount] of tokenMap.entries()) {
        tokens.push({
          token: token,
          tokenID: await ctx.getTokenID(token),
          amount: amount.toString(10)
        });
      }

      await bridge.contract.setConnectorTrusted(
        testSwappperBridgeConnector.address,
        true
      );

      const blockCallback = ctx.addBlockCallback(bridge.address);

      const connectorGroup: ConnectorGroup = {
        groupData: groupSettings,
        calls: []
      };

      for (const call of calls) {
        const transfer = await ctx.transfer(
          call.owner,
          bridge.address,
          call.token,
          new BN(call.amount),
          call.token,
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
          connector: testSwappperBridgeConnector.address,
          groupData: connectorGroup.groupData
        };
        const txHash = CollectTransferUtils.getHash(
          bridgeCallWrapper,
          bridge.address
        );
        await ctx.requestSignatureVerification(
          call.owner,
          ctx.hashToFieldElement("0x" + txHash.toString("hex"))
        );

        connectorGroup.calls.push(call);
      }

      for (const token of tokens) {
        await ctx.requestWithdrawal(
          bridge.address,
          token.token,
          new BN(token.amount),
          token.token,
          new BN(0),
          {
            authMethod: AuthMethod.NONE
          }
        );
      }

      let totalMinGas = 0;
      for (const call of connectorGroup.calls) {
        totalMinGas += call.minGas;
      }

      const connectorCalls: ConnectorCalls = {
        connector: testSwappperBridgeConnector.address,
        gasLimit: 1000000,
        totalMinGas,
        groups: [connectorGroup],
        tokens
      };

      const bridgeOperations: BridgeOperations = {
        transferOperations: [],
        connectorCalls: [connectorCalls],
        tokens
      };

      // Set the pool transaction data on the callback
      blockCallback.auxiliaryData = encodeBridgeOperations(
        bridge,
        bridgeOperations
      );
      blockCallback.numTxs = calls.length * 2 + tokens.length;

      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();

      await ctx.assertEventEmitted(bridge.contract, "BridgeCallSuccess");

      assert(false);
    });
  });
});
