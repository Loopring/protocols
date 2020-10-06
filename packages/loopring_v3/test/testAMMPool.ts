import BN = require("bn.js");
import { Constants, Signature } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { BalanceSnapshot, ExchangeTestUtil } from "./testExchangeUtil";
import { AuthMethod, SpotTrade } from "./types";
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
  actualMintAmount?: BN;
  actualAmounts?: BN[];
}

export interface PoolExit {
  txType?: "Exit";
  owner: string;
  burnAmount: BN;
  burnStorageID: number;
  exitMinAmounts: BN[];
  validUntil: number;

  signature?: string;
  authMethod: AuthMethod;
  actualAmounts?: BN[];
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
  signer?: string;
  validUntil?: number;
}

export interface ExitOptions {
  authMethod?: AuthMethod;
  signer?: string;
  validUntil?: number;
  forcedExitFee?: BN;
  skip?: boolean;
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
  public sharedConfig: any;

  public feeBips: number;
  public tokens: string[];
  public weights: BN[];

  public POOL_TOKEN_BASE: BN = new BN("10000000000");
  public POOL_TOKEN_MINTED_SUPPLY: BN = new BN("79228162514264337593543950335"); // uint96(-1)

  public totalSupply: BN;

  public tokenBalancesL2: BN[];

  constructor(ctx: ExchangeTestUtil) {
    this.ctx = ctx;
  }

  public async setupPool(
    sharedConfig: any,
    tokens: string[],
    weights: BN[],
    feeBips: number
  ) {
    this.sharedConfig = sharedConfig;
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
    const wrapper = await this.ctx.contracts.ExchangeV3.at(
      this.ctx.operator.address
    );
    await wrapper.registerToken(owner, {
      from: this.ctx.exchangeOwner
    });
    await this.ctx.addTokenToMaps(owner);

    // Setup the pool
    const poolConfig = {
      sharedConfig: sharedConfig.address,
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
    const signer = options.signer !== undefined ? options.signer : owner;
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
      join.signature = await sign(signer, hash, SignatureType.EIP_712);
      await verifySignature(signer, hash, join.signature);
    }

    await this.process(join);

    return join;
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
    const signer = options.signer !== undefined ? options.signer : owner;
    const validUntil =
      options.validUntil !== undefined ? options.validUntil : 0xffffffff;
    const forcedExitFee =
      options.forcedExitFee !== undefined
        ? options.forcedExitFee
        : await this.sharedConfig.forcedExitFee();
    const skip = options.skip !== undefined ? options.skip : false;

    const exit: PoolExit = {
      txType: "Exit",
      owner,
      burnAmount,
      burnStorageID: 0,
      exitMinAmounts,
      validUntil,
      authMethod
    };

    if (authMethod === AuthMethod.FORCE) {
      await this.contract.exitPool(burnAmount, exitMinAmounts, {
        from: owner,
        value: forcedExitFee,
        gasPrice: 0
      });
      const event = await this.ctx.assertEventEmitted(
        this.contract,
        "ForcedPoolExitRequested"
      );
      exit.validUntil = Number(event.exit.validUntil);
    } else if (authMethod === AuthMethod.ECDSA) {
      exit.burnStorageID = this.ctx.reserveStorageID();
      const hash = PoolExitUtils.getHash(exit, this.contract.address);
      exit.signature = await sign(signer, hash, SignatureType.EIP_712);
      await verifySignature(signer, hash, exit.signature);
    }

    if (!skip) {
      await this.process(exit);
    }

    return exit;
  }

  public async prePoolTransactions() {
    // Test framework not smart enough to immediately have the new balances after submitting a tx.
    // Have to create a block to get the current offchain balance.
    await this.ctx.submitTransactions();

    const owner = this.contract.address;
    this.tokenBalancesL2 = [];
    for (let i = 0; i < this.tokens.length; i++) {
      this.tokenBalancesL2.push(
        await this.ctx.getOffchainBalance(owner, this.tokens[i])
      );
    }
  }

  private async process(transaction: TxType) {
    const owner = this.contract.address;

    const blockCallback = this.ctx.addBlockCallback(owner);

    for (let i = 0; i < this.tokens.length; i++) {
      await this.ctx.requestAmmUpdate(
        owner,
        this.tokens[i],
        this.feeBips,
        /*this.weights[i]*/ new BN(0),
        { authMethod: AuthMethod.NONE }
      );
    }

    let poolTransaction: PoolTransaction;

    // Process the transaction
    if (transaction.txType === "Join") {
      const join = transaction;

      // Calculate expected amounts for specified liquidity tokens
      const poolTotal = this.totalSupply;

      let mintAmount = new BN(0);
      let amounts: BN[] = [];
      if (poolTotal.eq(new BN(0))) {
        mintAmount = this.POOL_TOKEN_BASE;
        amounts.push(...join.joinAmounts);
      } else {
        // Calculate the amount of liquidity tokens that should be minted
        let initialValueSet = false;
        for (let i = 0; i < this.tokens.length; i++) {
          if (this.tokenBalancesL2[i].gt(new BN(0))) {
            const amountOut = join.joinAmounts[i]
              .mul(poolTotal)
              .div(this.tokenBalancesL2[i]);
            if (!initialValueSet || amountOut.lt(mintAmount)) {
              mintAmount = amountOut;
              initialValueSet = true;
            }
          }
        }
        if (mintAmount.isZero()) {
          logDebug("Nothing to mint!");
        }
        if (!mintAmount.gte(join.mintMinAmount)) {
          logDebug("Min pool amount out not achieved!");
        }

        // Calculate the amounts to deposit
        let ratio = mintAmount.mul(this.POOL_TOKEN_BASE).div(poolTotal);
        for (let i = 0; i < this.tokens.length; i++) {
          amounts.push(
            this.tokenBalancesL2[i].mul(ratio).div(this.POOL_TOKEN_BASE)
          );
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
          join.joinFees[i],
          {
            authMethod: AuthMethod.NONE,
            amountToDeposit: new BN(0),
            feeToDeposit: new BN(0),
            storageID
          }
        );
        this.tokenBalancesL2[i].iadd(amount);
        logDebug("pool join: " + amount.toString(10));
      }
      join.actualMintAmount = mintAmount;
      join.actualAmounts = amounts;

      // Mint
      await this.ctx.transfer(
        owner,
        join.owner,
        owner,
        mintAmount,
        "ETH",
        new BN(0),
        {
          authMethod: AuthMethod.NONE,
          amountToDeposit: new BN(0)
        }
      );
      mintAmount = roundToFloatValue(mintAmount, Constants.Float24Encoding);
      poolTotal.iadd(mintAmount);

      poolTransaction = {
        txType: PoolTransactionType.JOIN,
        data: this.getPoolJoinAuxData(join),
        signature: join.signature
      };
    } else if (transaction.txType === "Exit") {
      const exit = transaction;

      const poolTotal = this.totalSupply;
      const ratio = exit.burnAmount.mul(this.POOL_TOKEN_BASE).div(poolTotal);

      let valid = true;
      let amounts: BN[] = [];
      for (let i = 0; i < this.tokens.length; i++) {
        amounts[i] = this.tokenBalancesL2[i]
          .mul(ratio)
          .div(this.POOL_TOKEN_BASE);
        valid = valid && amounts[i].gte(exit.exitMinAmounts[i]);
      }
      if (!valid) {
        logDebug("Exit min amounts not reached!");
      }

      if (exit.authMethod !== AuthMethod.FORCE) {
        if (!valid) {
          logDebug("Invalid slippage!");
        }
      }

      if (valid) {
        if (exit.authMethod !== AuthMethod.FORCE) {
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
        }

        // Withdraw
        for (let i = 0; i < this.tokens.length; i++) {
          const amount = roundToFloatValue(
            amounts[i],
            Constants.Float24Encoding
          );
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
          this.tokenBalancesL2[i].isub(amount);
          logDebug("pool exit: " + amount.toString(10));
        }

        exit.actualAmounts = amounts;
      }

      poolTransaction = {
        txType: PoolTransactionType.EXIT,
        data: this.getPoolExitAuxData(exit),
        signature: exit.signature
      };
      poolTotal.isub(
        roundToFloatValue(
          valid ? exit.burnAmount : new BN(0),
          Constants.Float24Encoding
        )
      );
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

    logDebug(poolTransaction);

    // Set the pool transaction data on the callback
    blockCallback.auxiliaryData = this.getAuxiliaryData(poolTransaction);
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

  public getAuxiliaryData(tx: PoolTransaction) {
    return web3.eth.abi.encodeParameter("tuple(uint256,bytes,bytes)", [
      tx.txType,
      web3.utils.hexToBytes(tx.data),
      web3.utils.hexToBytes(tx.signature ? tx.signature : "0x")
    ]);
  }

  public async verifySupply(expectedTotalSupply?: BN) {
    const onchainTotalSupply = await this.contract.totalSupply();
    if (expectedTotalSupply !== undefined) {
      assert(
        this.totalSupply.eq(expectedTotalSupply),
        "unexpected total supply"
      );
    }
    assert(this.totalSupply.eq(onchainTotalSupply), "unexpected total supply");
  }
}

contract("LoopringAmmPool", (accounts: string[]) => {
  let ctx: ExchangeTestUtil;

  let sharedConfig: any;
  let agentRegistry: any;
  let registryOwner: string;

  let ownerA: string;
  let ownerB: string;

  const setupDefaultPool = async () => {
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
          new BN(web3.utils.toWei("1000000", "ether"))
        );
      }
    }

    const pool = new AmmPool(ctx);
    await pool.setupPool(sharedConfig, tokens, weights, feeBipsAMM);

    await agentRegistry.registerUniversalAgent(pool.contract.address, true, {
      from: registryOwner
    });

    return pool;
  };

  before(async () => {
    ctx = new ExchangeTestUtil();
    await ctx.initialize(accounts);

    ownerA = ctx.testContext.orderOwners[10];
    ownerB = ctx.testContext.orderOwners[11];

    const loopringAmmSharedConfig = artifacts.require(
      "LoopringAmmSharedConfig"
    );
    sharedConfig = await loopringAmmSharedConfig.new();

    await sharedConfig.setMaxForcedExitAge(3600 * 24 * 7);
    await sharedConfig.setMaxForcedExitCount(100);
    await sharedConfig.setForcedExitFee(web3.utils.toWei("0.001", "ether"));
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
      const pool = await setupDefaultPool();

      await pool.prePoolTransactions();
      await pool.join(
        ownerA,
        pool.POOL_TOKEN_BASE,
        [
          new BN(web3.utils.toWei("10000.123456", "ether")),
          new BN(web3.utils.toWei("20000.654321", "ether"))
        ],
        [
          new BN(web3.utils.toWei("123.456789", "ether")),
          new BN(web3.utils.toWei("456.789", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await pool.join(
        ownerB,
        pool.POOL_TOKEN_BASE.div(new BN(11)),
        [
          new BN(web3.utils.toWei("1000", "ether")),
          new BN(web3.utils.toWei("2000", "ether"))
        ],
        [
          new BN(web3.utils.toWei("0", "ether")),
          new BN(web3.utils.toWei("789", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await ctx.submitTransactions(16);

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

      await pool.prePoolTransactions();
      await pool.exit(
        ownerA,
        pool.POOL_TOKEN_BASE.mul(new BN(6)).div(new BN(10)),
        [
          new BN(web3.utils.toWei("5000", "ether")),
          new BN(web3.utils.toWei("10000", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await pool.exit(
        ownerB,
        pool.POOL_TOKEN_BASE.mul(new BN(6)).div(new BN(100)),
        [
          new BN(web3.utils.toWei("500", "ether")),
          new BN(web3.utils.toWei("1000", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await ctx.submitTransactions(16);
      await ctx.submitPendingBlocks();
      await pool.verifySupply();

      // Withdraw some liquidity tokens
      await ctx.requestWithdrawal(
        ownerA,
        pool.contract.address,
        pool.POOL_TOKEN_BASE.div(new BN(10)),
        "ETH",
        new BN(0)
      );
      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();
      await pool.verifySupply();

      // Force exit
      await pool.prePoolTransactions();
      // Try to send too low an exit fee
      const forcedExitFee = await sharedConfig.forcedExitFee();
      await expectThrow(
        pool.exit(
          ownerA,
          pool.POOL_TOKEN_BASE.div(new BN(10)),
          [
            new BN(web3.utils.toWei("100", "ether")),
            new BN(web3.utils.toWei("100", "ether"))
          ],
          { authMethod: AuthMethod.FORCE, forcedExitFee: new BN(0) }
        ),
        "INVALID_ETH_VALUE"
      );
      await expectThrow(
        pool.exit(
          ownerA,
          pool.POOL_TOKEN_BASE.div(new BN(10)),
          [
            new BN(web3.utils.toWei("100", "ether")),
            new BN(web3.utils.toWei("100", "ether"))
          ],
          {
            authMethod: AuthMethod.FORCE,
            forcedExitFee: forcedExitFee.sub(new BN(1))
          }
        ),
        "INVALID_ETH_VALUE"
      );
      // Try to burn more than the owner owns
      await expectThrow(
        pool.exit(
          ownerA,
          pool.POOL_TOKEN_BASE,
          [
            new BN(web3.utils.toWei("100", "ether")),
            new BN(web3.utils.toWei("100", "ether"))
          ],
          { authMethod: AuthMethod.FORCE }
        ),
        "TRANSFER_FAILURE"
      );
      // Everything Okay
      {
        // Simulate the fee transfer
        const snapshot = new BalanceSnapshot(ctx);
        await snapshot.transfer(
          ownerA,
          await ctx.exchange.owner(),
          "ETH",
          forcedExitFee,
          "owner",
          "operator"
        );
        const exit = await pool.exit(
          ownerA,
          pool.POOL_TOKEN_BASE.div(new BN(20)),
          [
            new BN(web3.utils.toWei("100", "ether")),
            new BN(web3.utils.toWei("100", "ether"))
          ],
          { authMethod: AuthMethod.FORCE }
        );
        // Verify balances
        await snapshot.verifyBalances();
        // Try do another forced withdrawal from the same owner
        await expectThrow(
          pool.exit(
            ownerA,
            pool.POOL_TOKEN_BASE.div(new BN(20)),
            [
              new BN(web3.utils.toWei("100", "ether")),
              new BN(web3.utils.toWei("100", "ether"))
            ],
            {
              authMethod: AuthMethod.FORCE,
              forcedExitFee: forcedExitFee.sub(new BN(1))
            }
          ),
          "DUPLICATE"
        );
        await ctx.submitTransactions();
        await ctx.submitPendingBlocks();
        // Check ForcedExitProcessed event
        const event = await ctx.assertEventEmitted(
          pool.contract,
          "ForcedExitProcessed"
        );
        assert.equal(event.owner, exit.owner, "unexpected exit owner");
        assert(
          event.burnAmount.eq(exit.burnAmount),
          "unexpected exit burn amount"
        );
        assert.equal(
          event.amounts.length,
          pool.tokens.length,
          "unexpected exit num amounts"
        );
        for (let i = 0; i < event.amounts.length; i++) {
          assert(
            new BN(event.burnAmount, 10).eq(exit.burnAmount),
            "unexpected exit amount"
          );
        }
      }
      await pool.verifySupply();

      // Do another forced exit with min amounts that are not achieved.
      // Exit should be processed, but the exit should not go through.
      {
        const exit = await pool.exit(
          ownerA,
          pool.POOL_TOKEN_BASE.div(new BN(20)),
          [
            new BN(web3.utils.toWei("10000", "ether")),
            new BN(web3.utils.toWei("10000", "ether"))
          ],
          { authMethod: AuthMethod.FORCE }
        );
        // The user should have received his liquidity tokens back
        const snapshot = new BalanceSnapshot(ctx);
        await snapshot.transfer(
          pool.contract.address,
          exit.owner,
          pool.contract.address,
          exit.burnAmount,
          "pool",
          "owner"
        );
        await ctx.submitTransactions();
        await ctx.submitPendingBlocks();
        // Verify balances
        await snapshot.verifyBalances();
        // Check ForcedExitProcessed event
        const event = await ctx.assertEventEmitted(
          pool.contract,
          "ForcedExitProcessed"
        );
        assert.equal(event.owner, exit.owner, "unexpected exit owner");
        assert(event.burnAmount.eq(new BN(0)), "unexpected exit burn amount");
        assert.equal(event.amounts.length, 0, "unexpected exit num amounts");
      }
      await pool.verifySupply();
    });

    it("No join signature", async () => {
      const pool = await setupDefaultPool();
      await pool.prePoolTransactions();
      await pool.join(
        ownerA,
        pool.POOL_TOKEN_BASE,
        [
          new BN(web3.utils.toWei("1000", "ether")),
          new BN(web3.utils.toWei("2000", "ether"))
        ],
        [
          new BN(web3.utils.toWei("0", "ether")),
          new BN(web3.utils.toWei("0", "ether"))
        ],
        { authMethod: AuthMethod.NONE }
      );
      await ctx.submitTransactions();
      await expectThrow(ctx.submitPendingBlocks(), "SUB_UNDERFLOW");
    });

    it("Invalid join signature", async () => {
      const pool = await setupDefaultPool();
      await pool.prePoolTransactions();
      await pool.join(
        ownerA,
        pool.POOL_TOKEN_BASE,
        [
          new BN(web3.utils.toWei("1000", "ether")),
          new BN(web3.utils.toWei("2000", "ether"))
        ],
        [
          new BN(web3.utils.toWei("0", "ether")),
          new BN(web3.utils.toWei("0", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA, signer: ownerB }
      );
      await ctx.submitTransactions();
      await expectThrow(ctx.submitPendingBlocks(), "INVALID_JOIN_APPROVAL");
    });

    it("No exit signature", async () => {
      const pool = await setupDefaultPool();
      pool.totalSupply = pool.POOL_TOKEN_BASE;
      await pool.prePoolTransactions();
      await pool.exit(
        ownerA,
        pool.POOL_TOKEN_BASE,
        [
          new BN(web3.utils.toWei("10000", "ether")),
          new BN(web3.utils.toWei("10000", "ether"))
        ],
        { authMethod: AuthMethod.NONE }
      );
      await ctx.submitTransactions();
      await expectThrow(ctx.submitPendingBlocks(), "FORCED_EXIT_NOT_FOUND");
    });

    it("Invalid exit signature", async () => {
      const pool = await setupDefaultPool();
      pool.totalSupply = pool.POOL_TOKEN_BASE;
      await pool.prePoolTransactions();
      await pool.exit(
        ownerA,
        pool.POOL_TOKEN_BASE,
        [
          new BN(web3.utils.toWei("10000", "ether")),
          new BN(web3.utils.toWei("10000", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA, signer: ownerB }
      );
      await ctx.submitTransactions();
      await expectThrow(ctx.submitPendingBlocks(), "INVALID_EXIT_APPROVAL");
    });

    it("Invalid join slippage", async () => {
      const pool = await setupDefaultPool();

      await pool.prePoolTransactions();
      await pool.join(
        ownerA,
        pool.POOL_TOKEN_BASE,
        [
          new BN(web3.utils.toWei("10000.123456", "ether")),
          new BN(web3.utils.toWei("20000.654321", "ether"))
        ],
        [
          new BN(web3.utils.toWei("123.456789", "ether")),
          new BN(web3.utils.toWei("456.789", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await pool.join(
        ownerB,
        pool.POOL_TOKEN_BASE.div(new BN(10)),
        [
          new BN(web3.utils.toWei("1000", "ether")),
          new BN(web3.utils.toWei("2000", "ether"))
        ],
        [
          new BN(web3.utils.toWei("0", "ether")),
          new BN(web3.utils.toWei("789", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await ctx.submitTransactions(16);
      await expectThrow(ctx.submitPendingBlocks(), "JOIN_SLIPPAGE_INVALID");
    });

    it("Invalid exit slippage", async () => {
      const pool = await setupDefaultPool();

      await pool.prePoolTransactions();
      await pool.join(
        ownerA,
        pool.POOL_TOKEN_BASE,
        [
          new BN(web3.utils.toWei("10000.123456", "ether")),
          new BN(web3.utils.toWei("20000.654321", "ether"))
        ],
        [
          new BN(web3.utils.toWei("123.456789", "ether")),
          new BN(web3.utils.toWei("456.789", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await pool.join(
        ownerB,
        pool.POOL_TOKEN_BASE.div(new BN(11)),
        [
          new BN(web3.utils.toWei("1000", "ether")),
          new BN(web3.utils.toWei("2000", "ether"))
        ],
        [
          new BN(web3.utils.toWei("0", "ether")),
          new BN(web3.utils.toWei("789", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await ctx.submitTransactions(16);

      await pool.prePoolTransactions();
      await pool.exit(
        ownerA,
        pool.POOL_TOKEN_BASE.mul(new BN(6)).div(new BN(10)),
        [
          new BN(web3.utils.toWei("5000", "ether")),
          new BN(web3.utils.toWei("10000", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await pool.exit(
        ownerB,
        pool.POOL_TOKEN_BASE.mul(new BN(6)).div(new BN(100)),
        [
          new BN(web3.utils.toWei("5000", "ether")),
          new BN(web3.utils.toWei("10000", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await ctx.submitTransactions(16);
      await expectThrow(ctx.submitPendingBlocks(), "EXIT_SLIPPAGE_INVALID");
    });

    it("Shutdown", async () => {
      const pool = await setupDefaultPool();

      const amountsA = [
        new BN(web3.utils.toWei("10000", "ether")),
        new BN(web3.utils.toWei("20000", "ether"))
      ];
      const amountsB = [
        new BN(web3.utils.toWei("1000", "ether")),
        new BN(web3.utils.toWei("2000", "ether"))
      ];

      // Deposit to the pool
      await pool.prePoolTransactions();
      const joinA = await pool.join(
        ownerA,
        pool.POOL_TOKEN_BASE,
        amountsA,
        [
          new BN(web3.utils.toWei("123", "ether")),
          new BN(web3.utils.toWei("456", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      const joinB = await pool.join(
        ownerB,
        pool.POOL_TOKEN_BASE.div(new BN(10)),
        amountsB,
        [
          new BN(web3.utils.toWei("0", "ether")),
          new BN(web3.utils.toWei("789", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await ctx.submitTransactions(16);
      await ctx.submitPendingBlocks();
      await pool.verifySupply();

      // Withdraw ownerA's liquidity tokens
      await ctx.requestWithdrawal(
        ownerA,
        pool.contract.address,
        pool.POOL_TOKEN_BASE,
        "ETH",
        new BN(0)
      );
      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();
      await pool.verifySupply();

      // Try to shutdown without any pending forced exit
      await expectThrow(pool.contract.shutdown(ownerA), "INVALID_CHALLENGE");

      // Force exit
      await pool.prePoolTransactions();
      await pool.exit(ownerA, joinA.actualMintAmount.div(new BN(2)), amountsA, {
        authMethod: AuthMethod.FORCE,
        skip: true
      });

      // Try to shutdown too soon
      await expectThrow(pool.contract.shutdown(ownerA), "INVALID_CHALLENGE");

      const maxForcedExitAge = (
        await sharedConfig.maxForcedExitAge()
      ).toNumber();
      // Wait
      await ctx.advanceBlockTimestamp(maxForcedExitAge - 100);

      // Try to shutdown too soon
      await expectThrow(pool.contract.shutdown(ownerA), "INVALID_CHALLENGE");

      // Wait some more
      await ctx.advanceBlockTimestamp(200);

      // Try to withdraw before the pool is shutdown
      await expectThrow(pool.contract.withdrawWhenOffline(), "NOT_OFFLINE");

      // Shutdown
      await pool.contract.shutdown(ownerA, {
        value: new BN(web3.utils.toWei("1", "ether"))
      });
      await ctx.assertEventEmitted(pool.contract, "Shutdown");

      // Try to withdraw before the forced withdrawals are processed
      await expectThrow(
        pool.contract.withdrawWhenOffline(),
        "PENDING_WITHDRAWAL"
      );

      // Process the forced withdrawals
      for (const token of pool.tokens) {
        await ctx.requestWithdrawal(
          pool.contract.address,
          token,
          new BN(0),
          "ETH",
          new BN(0),
          {
            authMethod: AuthMethod.FORCE,
            skipForcedAuthentication: true,
            gas: 0
          }
        );
      }
      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();

      // Try to withdraw before the approved withdrawals have
      // actually been withdrawn to the pool contract.
      await expectThrow(
        pool.contract.withdrawWhenOffline(),
        "MORE_TO_WITHDRAWAL"
      );

      // Withdraw the approved withdrawals
      await pool.contract.withdrawFromApprovedWithdrawals();

      // Withdraw for ownerA
      {
        const snapshot = new BalanceSnapshot(ctx);
        for (const [i, token] of pool.tokens.entries()) {
          await snapshot.transfer(
            pool.contract.address,
            ownerA,
            token,
            amountsA[i],
            "pool",
            "owner"
          );
        }
        // Do the withdrawal
        await pool.contract.withdrawWhenOffline({ from: ownerA });
        // Verify balances
        await snapshot.verifyBalances();

        // Check if the expected amount was burned
        pool.totalSupply.isub(joinA.actualMintAmount);
        pool.verifySupply();

        // Try to withdraw again, nothing should be withdrawn
        await expectThrow(
          pool.contract.withdrawWhenOffline({ from: ownerA }),
          "ZERO_POOL_AMOUNT"
        );
      }

      // Withdraw ownerB's liquidity tokens
      await ctx.requestWithdrawal(
        ownerB,
        pool.contract.address,
        joinB.actualMintAmount,
        "ETH",
        new BN(0)
      );
      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();
      await pool.verifySupply();

      // Withdraw for ownerB
      {
        const snapshot = new BalanceSnapshot(ctx);
        for (const [i, token] of pool.tokens.entries()) {
          await snapshot.transfer(
            pool.contract.address,
            ownerB,
            token,
            amountsB[i],
            "pool",
            "owner"
          );
        }
        // Do the withdrawal
        await pool.contract.withdrawWhenOffline({ from: ownerB });
        // Verify balances
        await snapshot.verifyBalances();

        // Check if the expected amount was burned
        pool.totalSupply.isub(joinB.actualMintAmount);
        pool.verifySupply(new BN(0));
      }
    });
  });
});
