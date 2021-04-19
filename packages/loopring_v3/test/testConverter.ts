import BN = require("bn.js");
import { AmmPool, Permit, PermitUtils } from "./ammUtils";
import { expectThrow } from "./expectThrow";
import { Constants } from "loopringV3.js";
import { BalanceSnapshot, ExchangeTestUtil } from "./testExchangeUtil";
import { AuthMethod, SpotTrade } from "./types";
import { SignatureType, sign, verifySignature } from "../util/Signature";

const AgentRegistry = artifacts.require("AgentRegistry");

const TestConverter = artifacts.require("TestConverter");
const TestSwapper = artifacts.require("TestSwapper");

export class Converter {
  public ctx: ExchangeTestUtil;
  public contract: any;
  public address: string;

  public RATE_BASE: BN;
  public TOKEN_BASE: BN;

  public tokenIn: string;
  public tokenOut: string;
  public ticker: string;

  public totalSupply: BN;

  constructor(ctx: ExchangeTestUtil) {
    this.ctx = ctx;
    this.RATE_BASE = web3.utils.toWei("1", "ether");
    this.TOKEN_BASE = web3.utils.toWei("1", "ether");
  }

  public async setupConverter(
    tokenIn: string,
    tokenOut: string,
    ticker: string,
    rate: BN
  ) {
    this.tokenIn = tokenIn;
    this.tokenOut = tokenOut;
    this.ticker = ticker;

    const swapper = await TestSwapper.new(rate, false);

    this.contract = await TestConverter.new(
      this.ctx.exchange.address,
      swapper.address
    );
    await this.contract.initialize(
      "Loopring Convert - TOKA -> TOKB",
      "LC-TOKA-TOKB",
      18,
      this.ctx.getTokenAddress(tokenIn),
      this.ctx.getTokenAddress(tokenOut)
    );
    await this.contract.approveTokens();
    this.address = this.contract.address;

    await this.ctx.transferBalance(
      swapper.address,
      tokenOut,
      new BN(web3.utils.toWei("20", "ether"))
    );

    await this.ctx.registerToken(this.address, ticker);
  }

  public async verifySupply(expectedTotalSupply: BN) {
    const totalSupply = await this.contract.totalSupply();
    //console.log("totalSupply: " + totalSupply.toString(10));
    assert(totalSupply.eq(expectedTotalSupply), "unexpected total supply");
  }
}

contract("LoopringConverter", (accounts: string[]) => {
  let ctx: ExchangeTestUtil;

  let agentRegistry: any;
  let registryOwner: string;

  const amountIn = new BN(web3.utils.toWei("10", "ether"));
  const tradeAmountInA = amountIn.div(new BN(4));
  const tradeAmountInB = amountIn.div(new BN(4)).mul(new BN(3));

  let broker: string;
  let ownerA: string;
  let ownerB: string;

  const convertToken = async (
    _tokenIn: string,
    _tokenOut: string,
    ticker: string,
    rate: BN,
    expectedSuccess: boolean,
    doPhase2: boolean = true
  ) => {
    const RATE_BASE = new BN(web3.utils.toWei("1", "ether"));

    const converter = new Converter(ctx);
    await converter.setupConverter(_tokenIn, _tokenOut, ticker, rate);

    let minAmountOut = amountIn.mul(rate).div(RATE_BASE);
    if (!expectedSuccess) {
      minAmountOut = minAmountOut.add(new BN(1));
    }

    //console.log("broker: " + broker);
    //console.log("converter : " + converter.address);
    //console.log("amountIn     : " + amountIn.toString(10));
    //console.log("minAmountOut : " + minAmountOut.toString(10));

    // Phase 1
    {
      const ringA: SpotTrade = {
        orderA: {
          owner: broker,
          tokenS: converter.ticker,
          tokenB: converter.tokenIn,
          amountS: tradeAmountInA,
          amountB: tradeAmountInA,
          feeBips: 0,
          balanceS: new BN(0),
          balanceB: new BN(1)
        },
        orderB: {
          owner: ownerA,
          tokenS: converter.tokenIn,
          tokenB: converter.ticker,
          amountS: tradeAmountInA,
          amountB: tradeAmountInA,
          feeBips: 0
        },
        expected: {
          orderA: { filledFraction: 1.0, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };
      await ctx.setupRing(ringA);

      const ringB: SpotTrade = {
        orderA: {
          owner: broker,
          tokenS: converter.ticker,
          tokenB: converter.tokenIn,
          amountS: tradeAmountInB,
          amountB: tradeAmountInB,
          feeBips: 0,
          balanceS: new BN(0),
          balanceB: new BN(1)
        },
        orderB: {
          owner: ownerB,
          tokenS: converter.tokenIn,
          tokenB: converter.ticker,
          amountS: tradeAmountInB,
          amountB: tradeAmountInB,
          feeBips: 0
        },
        expected: {
          orderA: { filledFraction: 1.0, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };
      await ctx.setupRing(ringB);

      await ctx.flashDeposit(broker, converter.ticker, amountIn);

      await ctx.sendRing(ringA);
      await ctx.sendRing(ringB);

      await ctx.requestWithdrawal(
        broker,
        converter.tokenIn,
        amountIn,
        converter.tokenIn,
        new BN(0),
        { to: converter.address }
      );

      await ctx.addCallback(
        converter.address,
        converter.contract.contract.methods
          .convert(amountIn, minAmountOut, web3.utils.hexToBytes("0x"))
          .encodeABI(),
        false
      );

      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();
    }

    await converter.verifySupply(amountIn);

    if (!doPhase2) {
      return converter;
    }

    // Check result of phase 1 on the vault
    const failed = await converter.contract.failed();
    //console.log("failed: " + failed);
    assert.equal(failed, !expectedSuccess, "Conversion status unexpected!");

    const tokenOut = failed ? converter.tokenIn : converter.tokenOut;
    //const balance = await ctx.getOnchainBalance(
    //  converter.contract.address,
    //  tokenOut
    //);
    //console.log("Token: " + tokenOut);
    //console.log("Balance: " + balance.toString(10));

    const amountOut = failed ? amountIn : amountIn.mul(rate).div(RATE_BASE);
    const tradeAmountOutA = amountOut.div(new BN(4));
    const tradeAmountOutB = amountOut.div(new BN(4)).mul(new BN(3));

    //console.log("tradeAmountInA: " + tradeAmountInA.toString(10));
    //console.log("tradeAmountOutA: " + tradeAmountOutA.toString(10));

    // Phase 2
    {
      const ringA: SpotTrade = {
        orderA: {
          owner: broker,
          tokenS: tokenOut,
          tokenB: converter.ticker,
          amountS: tradeAmountOutA,
          amountB: tradeAmountInA,
          feeBips: 0
        },
        orderB: {
          owner: ownerA,
          tokenS: converter.ticker,
          tokenB: tokenOut,
          amountS: tradeAmountInA,
          amountB: tradeAmountOutA,
          feeBips: 0,
          balanceS: new BN(0),
          balanceB: new BN(0)
        },
        expected: {
          orderA: { filledFraction: 1.0, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };
      await ctx.setupRing(ringA, true, true, false, false);

      const ringB: SpotTrade = {
        orderA: {
          owner: broker,
          tokenS: tokenOut,
          tokenB: converter.ticker,
          amountS: tradeAmountOutB,
          amountB: tradeAmountInB,
          feeBips: 0
        },
        orderB: {
          owner: ownerB,
          tokenS: converter.ticker,
          tokenB: tokenOut,
          amountS: tradeAmountInB,
          amountB: tradeAmountOutB,
          feeBips: 20,
          balanceS: new BN(0),
          balanceB: new BN(0)
        },
        expected: {
          orderA: { filledFraction: 1.0, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };
      await ctx.setupRing(ringB, true, true, false, false);

      await ctx.flashDeposit(broker, tokenOut, amountOut);

      await ctx.sendRing(ringA);
      await ctx.sendRing(ringB);

      await ctx.requestWithdrawal(
        broker,
        converter.ticker,
        amountIn,
        converter.ticker,
        new BN(0),
        { to: ctx.operator.address }
      );

      //console.log("amountIn:  " + amountIn.toString(10));
      //console.log("amountOut: " + amountOut.toString(10));

      await ctx.addCallback(
        converter.address,
        converter.contract.contract.methods
          .withdraw(broker, amountIn, amountOut)
          .encodeABI(),
        false
      );

      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();

      //const balance = await converter.contract.balanceOf(converter.address);

      await converter.verifySupply(new BN(0));
    }
  };

  before(async () => {
    ctx = new ExchangeTestUtil();
    await ctx.initialize(accounts);

    broker = ctx.testContext.orderOwners[11];
    ownerA = ctx.testContext.orderOwners[12];
    ownerB = ctx.testContext.orderOwners[13];
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

  describe("Converter", function() {
    this.timeout(0);

    [true, false].forEach(function(success) {
      [
        new BN(web3.utils.toWei("1.0", "ether")),
        new BN(web3.utils.toWei("0.5", "ether")),
        new BN(web3.utils.toWei("2.0", "ether"))
      ].forEach(function(rate) {
        it(
          (success ? "Successful" : "Failed") +
            " conversion ERC20 -> ERC20 - rate: " +
            rate.toString(10),
          async () => {
            await convertToken("GTO", "WETH", "vETH", rate, success);
          }
        );

        it(
          (success ? "Successful" : "Failed") +
            " conversion ETH   -> ERC20 - rate: " +
            rate.toString(10),
          async () => {
            await convertToken("ETH", "GTO", "vETH", rate, success);
          }
        );

        it(
          (success ? "Successful" : "Failed") +
            " conversion ERC20 -> ETH   - rate: " +
            rate.toString(10),
          async () => {
            await convertToken("GTO", "ETH", "vETH", rate, success);
          }
        );
      });
    });

    it("Manual withdrawal", async () => {
      const rate = new BN(web3.utils.toWei("1.0", "ether"));
      const converter = await convertToken(
        "ETH",
        "WETH",
        "vETH",
        rate,
        true,
        false
      );

      await ctx.requestWithdrawal(
        ownerA,
        converter.ticker,
        tradeAmountInA,
        converter.ticker,
        new BN(0)
      );

      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();

      const snapshot = new BalanceSnapshot(ctx);
      await snapshot.transfer(
        converter.address,
        ownerA,
        converter.tokenOut,
        tradeAmountInA,
        "converter",
        "from"
      );

      await converter.verifySupply(amountIn);
      await converter.contract.withdraw(ownerA, tradeAmountInA, new BN(0), {
        from: ownerA
      });
      await converter.verifySupply(amountIn.sub(tradeAmountInA));

      // Verify balances
      await snapshot.verifyBalances();
    });
  });
});
