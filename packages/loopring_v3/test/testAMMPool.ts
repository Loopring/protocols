import BN = require("bn.js");
import { Constants, Signature } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { BlockCallback, ExchangeTestUtil } from "./testExchangeUtil";
import { AuthMethod, OrderInfo, SpotTrade } from "./types";

export class AmmPool {
  public ctx: ExchangeTestUtil;
  public contract: any;

  public feeBips: number;
  public tokens: string[];
  public weights: BN[];

  constructor(ctx: ExchangeTestUtil) {
    this.ctx = ctx;
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

    // Initial liquidity
    await this.ctx.deposit(
      this.ctx.testContext.orderOwners[0],
      this.contract.address,
      "WETH",
      new BN(web3.utils.toWei("10000", "ether")),
      { autoSetKeys: false }
    );
    await this.ctx.deposit(
      this.ctx.testContext.orderOwners[0],
      this.contract.address,
      "GTO",
      new BN(web3.utils.toWei("20000", "ether")),
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
    await this.contract.deposit(amounts);
  }

  public async process() {
    await this.ctx.submitTransactions();
    await this.ctx.submitPendingBlocks();

    const owner = this.contract.address;
    for (let i = 0; i < this.tokens.length; i++) {
      await this.ctx.requestAmmUpdate(
        owner,
        this.tokens[i],
        this.feeBips,
        this.weights[i],
        { authMethod: AuthMethod.NONE }
      );
    }

    const auxiliaryData = web3.eth.abi.encodeParameter("tuple(uint256)", [0]);
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
      const feeBipsAMM = 30;
      const tokens = ["WETH", "GTO"];
      const weights = [
        new BN(web3.utils.toWei("1", "ether")),
        new BN(web3.utils.toWei("1", "ether"))
      ];

      const pool = new AmmPool(ctx);
      await pool.setupPool(tokens, weights, feeBipsAMM);
      await pool.process();

      const ring: SpotTrade = {
        orderA: {
          owner: pool.contract.address,
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("98", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          //balanceS: new BN(web3.utils.toWei("10000", "ether")),
          //balanceB: new BN(web3.utils.toWei("20000", "ether")),
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
    });
  });
});
