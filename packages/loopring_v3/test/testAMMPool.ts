import BN = require("bn.js");
import { Constants, Signature } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { BlockCallback, ExchangeTestUtil } from "./testExchangeUtil";
import { AuthMethod, OrderInfo, SpotTrade } from "./types";

export interface PoolJoin {
  workType?: "PoolJoin";
  poolAmountOut: BN;
  maxAmountsIn: BN[];
}

export interface PoolExit {
  workType?: "PoolExit";
  poolAmountIn: BN;
  minAmountsOut: BN[];
}

type TxType = PoolJoin | PoolExit;

export class AmmPool {
  public ctx: ExchangeTestUtil;
  public contract: any;

  public feeBips: number;
  public tokens: string[];
  public weights: BN[];

  public queue: TxType[];

  constructor(ctx: ExchangeTestUtil) {
    this.ctx = ctx;
    this.queue = [];
  }

  public async setupPool(tokens: string[], weights: BN[], feeBips: number) {
    this.feeBips = feeBips;
    this.tokens = tokens;
    this.weights = weights;

    const AmmPool = artifacts.require("AmmPool");
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

    const tokenAddress: string[] = [];
    for (const token of tokens) {
      tokenAddress.push(this.ctx.getTokenAddress(token));
    }

    await this.contract.setupPool(
      this.ctx.exchange.address,
      deposit.accountID,
      tokenAddress,
      weights,
      feeBips
    );
  }

  public async deposit(owner: string, amounts: BN[]) {
    let value = new BN(0);
    for (let i = 0; i < this.tokens.length; i++) {
      const token = this.tokens[i];
      const amount = amounts[i];
      if (amount.gt(0)) {
        if (token !== Constants.zeroAddress) {
          const Token = await this.ctx.getTokenContract(token);
          await Token.setBalance(owner, amount);
          await Token.approve(this.contract.address, amount, { from: owner });
        } else {
          value = value.add(web3.utils.toBN(amount));
        }
      }
    }

    await this.contract.deposit(amounts, { value, from: owner });
  }

  public async join(owner: string, poolAmountOut: BN, maxAmountsIn: BN[]) {
    await this.contract.joinPool(poolAmountOut, maxAmountsIn, { from: owner });
    const poolJoin: PoolJoin = {
      workType: "PoolJoin",
      poolAmountOut,
      maxAmountsIn
    };
    this.queue.push(poolJoin);
  }

  public async exit(owner: string, poolAmountIn: BN, minAmountsOut: BN[]) {
    await this.contract.exitPool(poolAmountIn, minAmountsOut, { from: owner });
    const poolExit: PoolExit = {
      workType: "PoolExit",
      poolAmountIn,
      minAmountsOut
    };
    this.queue.push(poolExit);
  }

  public async depositAndJoin(
    owner: string,
    poolAmountOut: BN,
    maxAmountsIn: BN[]
  ) {
    await this.deposit(owner, maxAmountsIn);
    await this.join(owner, poolAmountOut, maxAmountsIn);
  }

  public async process() {
    // To make things easy always start a new block and finalize state
    await this.ctx.submitTransactions();
    await this.ctx.submitPendingBlocks();

    const owner = this.contract.address;

    const ammBalancesInAccount: BN[] = [];
    const ammBalances: BN[] = [];
    for (let i = 0; i < this.tokens.length; i++) {
      await this.ctx.requestAmmUpdate(
        owner,
        this.tokens[i],
        this.feeBips,
        this.weights[i],
        { authMethod: AuthMethod.NONE }
      );
      ammBalancesInAccount.push(
        await this.ctx.getOffchainBalance(owner, this.tokens[i])
      );
      ammBalances.push(
        await this.ctx.getOffchainBalance(owner, this.tokens[i])
      );
    }

    // Process work in the queue
    for (const item of this.queue) {
      if (item.workType === "PoolJoin") {
        for (let i = 0; i < this.tokens.length; i++) {
          const amount = item.maxAmountsIn[i];
          ammBalances[i] = ammBalances[i].add(amount);
          console.log("pool join: " + amount.toString(10));
        }
      } else if (item.workType === "PoolExit") {
        for (let i = 0; i < this.tokens.length; i++) {
          const amount = item.minAmountsOut[i];
          ammBalances[i] = ammBalances[i].sub(amount);
          console.log("pool exit: " + amount.toString(10));
        }
      }
    }

    // Deposit/Withdraw to/from the AMM account when necessary
    for (let i = 0; i < this.tokens.length; i++) {
      if (ammBalances[i].gt(ammBalancesInAccount[i])) {
        const amount = ammBalances[i].sub(ammBalancesInAccount[i]);
        await this.ctx.requestDeposit(owner, this.tokens[i], amount);
        console.log("pool deposit: " + amount.toString(10));
      } else if (ammBalances[i].lt(ammBalancesInAccount[i])) {
        const amount = ammBalancesInAccount[i].sub(ammBalances[i]);
        await this.ctx.requestWithdrawal(
          owner,
          this.tokens[i],
          amount,
          this.tokens[i],
          new BN(0),
          { authMethod: AuthMethod.NONE, minGas: 0 }
        );
        console.log("pool withdraw: " + amount.toString(10));
      }
    }

    const numItems = this.queue.length;
    this.queue = [];
    console.log("queue: " + numItems);

    const auxiliaryData = web3.eth.abi.encodeParameter("tuple(uint256)", [
      numItems
    ]);
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
}

contract("AMM Pool", (accounts: string[]) => {
  let ctx: ExchangeTestUtil;

  before(async () => {
    ctx = new ExchangeTestUtil();
    await ctx.initialize(accounts);
  });

  after(async () => {
    await ctx.stop();
  });

  beforeEach(async () => {
    // Fresh Exchange for each test
    await ctx.createExchange(ctx.testContext.stateOwners[0], {
      setupTestState: true
    });
  });

  describe("AMM", function() {
    this.timeout(0);

    it.only("Successful swap (AMM maker)", async () => {
      const ownerA = ctx.testContext.orderOwners[10];

      const feeBipsAMM = 30;
      const tokens = ["WETH", "GTO"];
      const weights = [
        new BN(web3.utils.toWei("1", "ether")),
        new BN(web3.utils.toWei("1", "ether"))
      ];

      const pool = new AmmPool(ctx);
      await pool.setupPool(tokens, weights, feeBipsAMM);

      await pool.depositAndJoin(
        ownerA,
        new BN(web3.utils.toWei("1", "ether")),
        [
          new BN(web3.utils.toWei("10000", "ether")),
          new BN(web3.utils.toWei("20000", "ether"))
        ]
      );

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

      await pool.exit(ownerA, new BN(web3.utils.toWei("1", "ether")), [
        new BN(web3.utils.toWei("5000", "ether")),
        new BN(web3.utils.toWei("10000", "ether"))
      ]);
      await pool.process();
    });
  });
});
