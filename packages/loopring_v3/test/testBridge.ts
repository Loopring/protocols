import BN = require("bn.js");
import { AmmPool, Permit, PermitUtils } from "./ammUtils";
import { expectThrow } from "./expectThrow";
import { Constants } from "loopringV3.js";
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
}

export interface ConnectorGroup {
  groupData: string;
  calls: BridgeCall[];
}

export interface ConnectorCalls {
  connector: string;
  groups: ConnectorGroup[];
  tokens: TokenData[];
}

export interface TransferOperation {
  batchID: number;
  transfers: BridgeTransfer[];
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

  describe.only("Bridge", function() {
    this.timeout(0);

    it("Batch deposit", async () => {
      const bridge = await setupBridge();

      const deposits: BridgeTransfer[] = [];
      deposits.push({
        owner: ownerA,
        token: Constants.zeroAddress,
        amount: web3.utils.toWei("1", "ether")
      });
      deposits.push({
        owner: ownerB,
        token: Constants.zeroAddress,
        amount: web3.utils.toWei("2", "ether")
      });
      deposits.push({
        owner: ownerC,
        token: Constants.zeroAddress,
        amount: web3.utils.toWei("3", "ether")
      });

      await bridge.contract.batchDeposit(relayer, deposits, {
        from: relayer,
        value: new BN(web3.utils.toWei("6", "ether"))
      });
      const event = await ctx.assertEventEmitted(bridge.contract, "Transfers");

      // Process the single deposit
      await ctx.requestDeposit(
        bridge.address,
        "ETH",
        new BN(web3.utils.toWei("6", "ether"))
      );

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

      const bridgeOperations: BridgeOperations = {
        transferOperations: [
          { batchID: event.batchID.toNumber(), transfers: deposits }
        ],
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

    it("Batch call", async () => {
      const bridge = await setupBridge();

      const totalETH = new BN(web3.utils.toWei("6", "ether"));

      const withdrawals: BridgeTransfer[] = [];
      withdrawals.push({
        owner: ownerA,
        token: Constants.zeroAddress,
        amount: web3.utils.toWei("1", "ether")
      });
      withdrawals.push({
        owner: ownerB,
        token: Constants.zeroAddress,
        amount: web3.utils.toWei("2", "ether")
      });
      withdrawals.push({
        owner: ownerC,
        token: Constants.zeroAddress,
        amount: web3.utils.toWei("3", "ether")
      });

      for (const withdrawal of withdrawals) {
        await ctx.deposit(
          withdrawal.owner,
          withdrawal.owner,
          withdrawal.token,
          new BN(withdrawal.amount)
        );
      }

      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();

      await bridge.contract.setConnectorTrusted(
        testSwappperBridgeConnector.address,
        true
      );

      const tokens: TokenData[] = [];
      tokens.push({
        token: Constants.zeroAddress,
        tokenID: 0,
        amount: totalETH.toString(10)
      });

      const blockCallback = ctx.addBlockCallback(bridge.address);

      const encodedSettings = web3.eth.abi.encodeParameter(
        {
          "struct Settings": {
            tokenIn: "address",
            tokenOut: "address"
          }
        },
        {
          tokenIn: ctx.getTokenAddress(tokenIn),
          tokenOut: ctx.getTokenAddress(tokenOut)
        }
      );

      const connectorGroup: ConnectorGroup = {
        groupData: encodedSettings,
        calls: []
      };

      const connectorCalls: ConnectorCalls = {
        connector: testSwappperBridgeConnector.address,
        groups: [connectorGroup],
        tokens
      };

      for (const withdrawal of withdrawals) {
        const transfer = await ctx.transfer(
          withdrawal.owner,
          bridge.address,
          withdrawal.token,
          new BN(withdrawal.amount),
          withdrawal.token,
          new BN(0),
          {
            authMethod: AuthMethod.NONE,
            amountToDeposit: new BN(0),
            feeToDeposit: new BN(0)
          }
        );

        const call: BridgeCall = {
          owner: withdrawal.owner,
          token: withdrawal.token,
          amount: withdrawal.amount,
          minGas: 1000000,
          maxFee: "0",
          userData: "0x"
        };
        const bridgeCallWrapper: BridgeCallWrapper = {
          transfer,
          call,
          connector: connectorCalls.connector,
          groupData: connectorGroup.groupData
        };
        const txHash = CollectTransferUtils.getHash(
          bridgeCallWrapper,
          bridge.address
        );
        await ctx.requestSignatureVerification(
          withdrawal.owner,
          ctx.hashToFieldElement("0x" + txHash.toString("hex"))
        );

        connectorGroup.calls.push(call);
      }

      await ctx.requestWithdrawal(
        bridge.address,
        "ETH",
        totalETH,
        "ETH",
        new BN(0),
        {
          authMethod: AuthMethod.NONE
        }
      );

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
      blockCallback.numTxs = withdrawals.length * 2 + 1;

      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();

      await ctx.assertEventEmitted(bridge.contract, "BridgeCallSuccess");

      //assert(false);
    });
  });
});
