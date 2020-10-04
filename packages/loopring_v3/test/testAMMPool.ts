import BN = require("bn.js");
import { Constants, Signature } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { BlockCallback, ExchangeTestUtil } from "./testExchangeUtil";
import { AuthMethod, OrderInfo, SpotTrade } from "./types";
import * as sigUtil from "eth-sig-util";
import { SignatureType, sign, verifySignature } from "../util/Signature";
import { roundToFloatValue } from "loopringV3.js";
import { logDebug } from "./logs";

const AgentRegistry = artifacts.require("AgentRegistry");

export enum PoolTransactionType {
  NOOP,
  JOIN,
  EXIT
}

export interface PoolJoin {
  txType?: "Join";
  owner: string;
  joinAmounts: BN[];
  joinFees: BN[];
  joinStorageIDs: number[];
  mintMinAmount: BN;
  validUntil: number;
  signature?: string;
}

export interface PoolExit {
  txType?: "Exit";
  owner: string;
  burnAmount: BN;
  burnStorageID: number;
  exitMinAmounts: BN[];
  validUntil: number;
  signature?: string;
}

export interface PoolTransaction {
  txType: number;
  data: string;
  signature: string;
}

export interface AuxiliaryData {
  poolTransactions: PoolTransaction[];
}

export interface JoinOptions {
  authMethod?: AuthMethod;
  validUntil?: number;
}

export interface ExitOptions {
  authMethod?: AuthMethod;
  validUntil?: number;
}

type TxType = PoolJoin | PoolExit;

export namespace PoolJoinUtils {
  export function toTypedData(join: PoolJoin, verifyingContract: string) {
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" }
        ],
        PoolJoin: [
          { name: "owner", type: "address" },
          { name: "joinAmounts", type: "uint96[]" },
          { name: "joinFees", type: "uint96[]" },
          { name: "joinStorageIDs", type: "uint32[]" },
          { name: "mintMinAmount", type: "uint96" },
          { name: "validUntil", type: "uint32" }
        ]
      },
      primaryType: "PoolJoin",
      domain: {
        name: "AMM Pool",
        version: "1.0.0",
        chainId: new BN(/*await web3.eth.net.getId()*/ 1),
        verifyingContract
      },
      message: {
        owner: join.owner,
        joinAmounts: join.joinAmounts,
        joinFees: join.joinFees,
        joinStorageIDs: join.joinStorageIDs,
        mintMinAmount: join.mintMinAmount,
        validUntil: join.validUntil
      }
    };
    return typedData;
  }

  export function getHash(join: PoolJoin, verifyingContract: string) {
    const typedData = this.toTypedData(join, verifyingContract);
    return sigUtil.TypedDataUtils.sign(typedData);
  }
}

export namespace PoolExitUtils {
  export function toTypedData(exit: PoolExit, verifyingContract: string) {
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" }
        ],
        PoolExit: [
          { name: "owner", type: "address" },
          { name: "burnAmount", type: "uint96" },
          { name: "burnStorageID", type: "uint32" },
          { name: "exitMinAmounts", type: "uint96[]" },
          { name: "validUntil", type: "uint32" }
        ]
      },
      primaryType: "PoolExit",
      domain: {
        name: "AMM Pool",
        version: "1.0.0",
        chainId: new BN(/*await web3.eth.net.getId()*/ 1),
        verifyingContract
      },
      message: {
        owner: exit.owner,
        burnAmount: exit.burnAmount,
        burnStorageID: exit.burnStorageID,
        exitMinAmounts: exit.exitMinAmounts,
        validUntil: exit.validUntil
      }
    };
    return typedData;
  }

  export function getHash(exit: PoolExit, verifyingContract: string) {
    const typedData = this.toTypedData(exit, verifyingContract);
    return sigUtil.TypedDataUtils.sign(typedData);
  }
}

export class AmmPool {
  public ctx: ExchangeTestUtil;
  public contract: any;

  public feeBips: number;
  public tokens: string[];
  public weights: BN[];

  public POOL_TOKEN_BASE: BN = new BN("10000000000");
  public POOL_TOKEN_MINTED_SUPPLY: BN = new BN("79228162514264337593543950335"); // uint96(-1)

  public totalSupply: BN;

  public pendingTransactions: TxType[];
  constructor(ctx: ExchangeTestUtil) {
    this.ctx = ctx;
    this.pendingTransactions = [];
  }

  public async setupPool(sharedConfig: string, tokens: string[], weights: BN[], feeBips: number) {
    this.feeBips = feeBips;
    this.tokens = tokens;
    this.weights = weights;

    this.totalSupply = new BN(0);

    const AmmPool = artifacts.require("LoopringAmmPool");
    this.contract = await AmmPool.new();

    // Create the AMM account
    const owner = this.contract.address;
    const deposit = await this.ctx.deposit(
      this.ctx.testContext.orderOwners[0],
      owner,
      "ETH",
      new BN(1),
      { autoSetKeys: false }
    );

    // Collect token addresses
    const tokenAddresses: string[] = [];
    for (const token of tokens) {
      tokenAddresses.push(this.ctx.getTokenAddress(token));
    }

    // Collect token addresses
    const strWeights: string[] = [];
    for (const weight of weights) {
      strWeights.push(weight.toString(10));
    }

    // Register the pool token
    const wrapper = await this.ctx.contracts.ExchangeV3.at(this.ctx.operator.address);
    await wrapper.registerToken(owner, {
      from: this.ctx.exchangeOwner
    });
    await this.ctx.addTokenToMaps(owner);

    // Setup the pool
    const poolConfig = {
      sharedConfig,
      exchange: this.ctx.exchange.address,
      poolName: "AMM Pool",
      accountID: deposit.accountID,
      tokens: tokenAddresses,
      weights: strWeights,
      feeBips,
      tokenSymbol: "LP-LRC"
    };
    await this.contract.setupPool(poolConfig);

    // Handle deposit of liquidity tokens done by setup
    await this.ctx.requestDeposit(owner, owner, this.POOL_TOKEN_MINTED_SUPPLY);
  }

  public async join(
    owner: string,
    mintMinAmount: BN,
    joinAmounts: BN[],
    joinFees: BN[],
    options: JoinOptions = {}
  ) {
    // Fill in defaults
    const authMethod =
      options.authMethod !== undefined ? options.authMethod : AuthMethod.ECDSA;
    const validUntil =
      options.validUntil !== undefined ? options.validUntil : 0xffffffff;

    const join: PoolJoin = {
      txType: "Join",
      owner,
      joinAmounts,
      joinFees,
      joinStorageIDs: [],
      mintMinAmount,
      validUntil
    };

    if (authMethod === AuthMethod.APPROVE) {
      assert(false, "unsupported");
      /*await this.contract.joinPool(
        minPoolAmountOut,
        maxAmountsIn,
        fromLayer2,
        validUntil,
        {
          from: owner
        }
      );*/
    } else if (authMethod === AuthMethod.ECDSA) {
      for (const token of this.tokens) {
        join.joinStorageIDs.push(this.ctx.reserveStorageID());
      }
      const hash = PoolJoinUtils.getHash(join, this.contract.address);
      join.signature = await sign(owner, hash, SignatureType.EIP_712);
      await verifySignature(owner, hash, join.signature);
    }

    this.pendingTransactions.push(join);
  }

  public async exit(
    owner: string,
    burnAmount: BN,
    exitMinAmounts: BN[],
    options: ExitOptions = {}
  ) {
    // Fill in defaults
    const authMethod =
      options.authMethod !== undefined ? options.authMethod : AuthMethod.ECDSA;
    const validUntil =
      options.validUntil !== undefined ? options.validUntil : 0xffffffff;

    const exit: PoolExit = {
      txType: "Exit",
      owner,
      burnAmount,
      burnStorageID: 0,
      exitMinAmounts,
      validUntil
    };

    if (authMethod === AuthMethod.APPROVE) {
      assert(false, "unsupported");
      /*await this.contract.exitPool(poolAmountIn, minAmountsOut, toLayer2, {
        from: owner
      });*/
    } else if (authMethod === AuthMethod.ECDSA) {
      exit.burnStorageID = this.ctx.reserveStorageID();
      const hash = PoolExitUtils.getHash(exit, this.contract.address);
      exit.signature = await sign(owner, hash, SignatureType.EIP_712);
      await verifySignature(owner, hash, exit.signature);
    }

    this.pendingTransactions.push(exit);
  }

  public async process() {
    // To make things easy always start a new block and finalize state
    await this.ctx.submitTransactions();
    await this.ctx.submitPendingBlocks();

    const owner = this.contract.address;

    const tokenBalancesL2: BN[] = [];
    for (let i = 0; i < this.tokens.length; i++) {
      await this.ctx.requestAmmUpdate(
        owner,
        this.tokens[i],
        this.feeBips,
        /*this.weights[i]*/ new BN(0),
        { authMethod: AuthMethod.NONE }
      );
      tokenBalancesL2.push(
        await this.ctx.getOffchainBalance(owner, this.tokens[i])
      );
    }

    const poolTransactions: PoolTransaction[] = [];

    // Process the pending transactions
    for (const item of this.pendingTransactions) {
      if (item.txType === "Join") {
        const join = item;

        // Calculate expected amounts for specified liquidity tokens
        const poolTotal = this.totalSupply;

        let poolAmountOut = new BN(0);
        let amounts: BN[] = [];
        if (poolTotal.eq(new BN(0))) {
          poolAmountOut = this.POOL_TOKEN_BASE;
          amounts.push(...join.joinAmounts);
        } else {
          // Calculate the amount of liquidity tokens that should be minted
          let initialValueSet = false;
          for (let i = 0; i < this.tokens.length; i++) {
            if (tokenBalancesL2[i].gt(new BN(0))) {
              const amountOut = join.joinAmounts[i]
                .mul(poolTotal)
                .div(tokenBalancesL2[i]);
              if (!initialValueSet || amountOut.lt(poolAmountOut)) {
                poolAmountOut = amountOut;
                initialValueSet = true;
              }
            }
          }
          assert(
            poolAmountOut.gte(join.mintMinAmount),
            "min pool amounts out not achieved"
          );

          // Calculate the amounts to deposit
          let ratio = poolAmountOut.mul(this.POOL_TOKEN_BASE).div(poolTotal);
          for (let i = 0; i < this.tokens.length; i++) {
            amounts.push(tokenBalancesL2[i].mul(ratio).div(this.POOL_TOKEN_BASE));
          }
        }

        // Deposit
        for (let i = 0; i < this.tokens.length; i++) {
          const amount = roundToFloatValue(amounts[i], Constants.Float24Encoding);
          const storageID =
            join.joinStorageIDs.length > 0 ? join.joinStorageIDs[i] : undefined;
          await this.ctx.transfer(
            join.owner,
            owner,
            this.tokens[i],
            amount,
            this.tokens[i],
            new BN(0),
            {
              authMethod: AuthMethod.NONE,
              amountToDeposit: new BN(0),
              storageID
            }
          );
          tokenBalancesL2[i].iadd(amount);
          logDebug("pool join: " + amount.toString(10));
        }

        // Mint
        await this.ctx.transfer(
          owner,
          join.owner,
          owner,
          poolAmountOut,
          "ETH",
          new BN(0),
          {
            authMethod: AuthMethod.NONE,
            amountToDeposit: new BN(0)
          }
        );
        poolAmountOut = roundToFloatValue(poolAmountOut, Constants.Float24Encoding);
        poolTotal.iadd(poolAmountOut);

        poolTransactions.push({
          txType: PoolTransactionType.JOIN,
          data: this.getPoolJoinAuxData(join),
          signature: join.signature
        });

      } else if (item.txType === "Exit") {
        const exit = item;

        const poolTotal = this.totalSupply;
        const ratio = exit.burnAmount.mul(this.POOL_TOKEN_BASE).div(poolTotal);

        // Burn
        await this.ctx.transfer(
          exit.owner,
          owner,
          owner,
          exit.burnAmount,
          "ETH",
          new BN(0),
          {
            authMethod: AuthMethod.NONE,
            amountToDeposit: new BN(0),
            storageID: exit.burnStorageID
          }
        );

        // Withdraw
        for (let i = 0; i < this.tokens.length; i++) {
          let amount = tokenBalancesL2[i].mul(ratio).div(this.POOL_TOKEN_BASE);
          amount = roundToFloatValue(amount, Constants.Float24Encoding);
          await this.ctx.transfer(
            owner,
            exit.owner,
            this.tokens[i],
            amount,
            "ETH",
            new BN(0),
            {
              authMethod: AuthMethod.NONE,
              amountToDeposit: new BN(0),
              transferToNew: true
            }
          );
          tokenBalancesL2[i].isub(amount);
          logDebug("pool exit: " + amount.toString(10));
        }

        poolTransactions.push({
          txType: PoolTransactionType.EXIT,
          data: this.getPoolExitAuxData(exit),
          signature: exit.signature
        });
        poolTotal.isub(roundToFloatValue(exit.burnAmount, Constants.Float24Encoding));
      }
    }

    // Re-enable weights
    for (let i = 0; i < this.tokens.length; i++) {
      await this.ctx.requestAmmUpdate(
        owner,
        this.tokens[i],
        this.feeBips,
        this.weights[i],
        { authMethod: AuthMethod.NONE }
      );
    }

    this.pendingTransactions = [];

    logDebug(poolTransactions);
    const auxiliaryData = this.getAuxiliaryData(poolTransactions);
    const blockCallbacks: BlockCallback[] = [];
    blockCallbacks.push({
      target: owner,
      blockIdx: 0,
      txIdx: 0,
      auxiliaryData
    });
    await this.ctx.submitTransactions();
    await this.ctx.submitPendingBlocks(blockCallbacks);
  }

  public getPoolJoinAuxData(join: PoolJoin) {
    const amounts: string[] = [];
    for (const amount of join.joinAmounts) {
      amounts.push(amount.toString(10));
    }
    const fees: string[] = [];
    for (const fee of join.joinFees) {
      fees.push(fee.toString(10));
    }
    return web3.eth.abi.encodeParameter(
      "tuple(address,uint96[],uint96[],uint32[],uint96,uint32)",
      [
        join.owner,
        amounts,
        fees,
        join.joinStorageIDs,
        join.mintMinAmount.toString(10),
        join.validUntil
      ]
    );
  }

  public getPoolExitAuxData(exit: PoolExit) {
    const amounts: string[] = [];
    for (const amount of exit.exitMinAmounts) {
      amounts.push(amount.toString(10));
    }
    return web3.eth.abi.encodeParameter(
      "tuple(address,uint96,uint32,uint96[],uint32)",
      [
        exit.owner,
        exit.burnAmount.toString(10),
        exit.burnStorageID,
        amounts,
        exit.validUntil
      ]
    );
  }

  public getAuxiliaryData(txs: PoolTransaction[]) {
    /*const auxiliaryData: any[] = [];
    for (const tx of txs) {
      auxiliaryData.push([
        tx.txType,
        web3.utils.hexToBytes(tx.data),
        web3.utils.hexToBytes(tx.signature ? tx.signature : "0x")
      ]);
    }*/
    assert(txs.length == 1, "unsupported");
    const tx = txs[0];
    return web3.eth.abi.encodeParameter(
      "tuple(uint256,bytes,bytes)",
      [
        tx.txType,
        web3.utils.hexToBytes(tx.data),
        web3.utils.hexToBytes(tx.signature ? tx.signature : "0x")
      ]
    );
  }
}

contract("LoopringAmmPool", (accounts: string[]) => {
  let ctx: ExchangeTestUtil;

  let sharedConfig: any;
  let agentRegistry: any;
  let registryOwner: string;

  before(async () => {
    ctx = new ExchangeTestUtil();
    await ctx.initialize(accounts);

    const loopringAmmSharedConfig = artifacts.require("LoopringAmmSharedConfig");
    sharedConfig = await loopringAmmSharedConfig.new();

    await sharedConfig.setMaxForcedExitAge(3600 * 24 * 7);
    await sharedConfig.setMaxForcedExitCount(100);
    await sharedConfig.setForcedExitFee(
      web3.utils.toWei("0.001", "ether")
    );
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

  describe("AMM", function() {
    this.timeout(0);

    it("Successful swap (AMM maker)", async () => {
      const ownerA = ctx.testContext.orderOwners[10];
      const ownerB = ctx.testContext.orderOwners[11];

      const feeBipsAMM = 30;
      const tokens = ["WETH", "GTO"];
      const weights = [
        new BN(web3.utils.toWei("1", "ether")),
        new BN(web3.utils.toWei("1", "ether"))
      ];

      for (const owner of [ownerA, ownerB]) {
        for (const token of tokens) {
          await ctx.deposit(
            owner,
            owner,
            token,
            new BN(
              web3.utils.toWei(
                token === "WETH" ? "10000.123456" : "20000.654321",
                "ether"
              )
            )
          );
        }
      }

      const pool = new AmmPool(ctx);
      await pool.setupPool(sharedConfig.address, tokens, weights, feeBipsAMM);

      await agentRegistry.registerUniversalAgent(pool.contract.address, true, {
        from: registryOwner
      });

      await pool.join(
        ownerA,
        pool.POOL_TOKEN_BASE,
        [
          new BN(web3.utils.toWei("10000.123456", "ether")),
          new BN(web3.utils.toWei("20000.654321", "ether"))
        ],
        [new BN(0), new BN(0)],
        { authMethod: AuthMethod.ECDSA }
      );
      /*await pool.join(
        ownerB,
        new BN(web3.utils.toWei("100", "ether")),
        [
          new BN(web3.utils.toWei("10000.123456", "ether")),
          new BN(web3.utils.toWei("20000.654321", "ether"))
        ],
        [new BN(0), new BN(0)],
        { authMethod: AuthMethod.ECDSA }
      );*/
      await pool.process();

      const ring: SpotTrade = {
        orderA: {
          owner: pool.contract.address,
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("98", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          feeBips: 0,
          amm: true
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("98", "ether"))
        },
        expected: {
          orderA: { filledFraction: 1.0, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };
      await ctx.setupRing(ring, true, true, false, true);

      await ctx.deposit(
        ctx.exchangeOperator,
        ctx.exchangeOperator,
        ring.orderA.tokenB,
        ring.orderA.amountB
      );

      await ctx.sendRing(ring);
      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();

      await pool.exit(
        ownerA,
        pool.POOL_TOKEN_BASE.mul(new BN(6)).div(new BN(10)),
        [
          new BN(web3.utils.toWei("5000", "ether")),
          new BN(web3.utils.toWei("10000", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      /*await pool.exit(
        ownerB,
        new BN(web3.utils.toWei("60", "ether")),
        [
          new BN(web3.utils.toWei("5000", "ether")),
          new BN(web3.utils.toWei("10000", "ether"))
        ],
        true,
        { authMethod: AuthMethod.ECDSA }
      );*/
      await pool.process();
    });
  });
});
