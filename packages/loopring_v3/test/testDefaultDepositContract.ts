import { expectThrow } from "./expectThrow";
import { Artifacts } from "../util/Artifacts";
import { Constants } from "loopringV3.js";
import { ExchangeTestUtil } from "./testExchangeUtil";
import BN = require("bn.js");

contract("DefaultDepositContract", (accounts: string[]) => {
  let contracts: Artifacts;

  const exchange1 = accounts[0];
  const exchange2 = accounts[1];

  const owner1 = accounts[10];
  const owner2 = accounts[11];

  let depositContract: any;

  let token: any;

  let ctx: ExchangeTestUtil;
  let exchange: any;

  const createExchange = async () => {
    await ctx.createExchange(ctx.testContext.stateOwners[0]);
    exchange = ctx.exchange;
  };

  before(async () => {
    ctx = new ExchangeTestUtil();
    await ctx.initialize(accounts);
    contracts = ctx.contracts;
  });

  beforeEach(async () => {
    depositContract = await contracts.DefaultDepositContract.new();
    token = await contracts.LRCToken.new({ from: owner1 });
  });

  describe("exchange", () => {
    it("should be to call the interface functions", async () => {
      const exchange = exchange1;
      await depositContract.initialize(exchange1);

      await depositContract.deposit(owner1, token.address, new BN(0), "0x", {
        from: exchange
      });
      await depositContract.withdraw(
        owner1,
        owner1,
        token.address,
        new BN(0),
        "0x",
        {
          from: exchange
        }
      );
      await depositContract.transfer(owner1, owner2, token.address, new BN(0), {
        from: exchange
      });
    });

    // it("should not be able to send a wrong amount of ETH in a deposit", async () => {
    //   const exchange = exchange1;
    //   await depositContract.initialize(exchange1);

    //   await expectThrow(
    //     depositContract.deposit(
    //       owner1,
    //       Constants.zeroAddress,
    //       new BN(2),
    //       "0x",
    //       {
    //         from: exchange,
    //         value: new BN(1)
    //       }
    //     ),
    //     "INVALID_ETH_DEPOSIT"
    //   );
    //   await expectThrow(
    //     depositContract.deposit(owner1, token.address, new BN(1), "0x", {
    //       from: exchange,
    //       value: new BN(1)
    //     }),
    //     "INVALID_TOKEN_DEPOSIT"
    //   );
    // });
  });

  describe("anyone", () => {
    it("should be able to check if an address is used for ETH", async () => {
      assert(await depositContract.isETH(Constants.zeroAddress), "0x0 is ETH");
      assert(
        !(await depositContract.isETH(token.address)),
        "should not be ETH"
      );
    });

    it("should not be able to initialize again", async () => {
      await depositContract.initialize(exchange1);
      await expectThrow(
        depositContract.initialize(exchange2),
        "INVALID_EXCHANGE"
      );
    });

    it("should not be able to call the interface functions", async () => {
      await depositContract.initialize(exchange1);
      await expectThrow(
        depositContract.deposit(owner1, token.address, new BN(0), "0x", {
          from: exchange2
        }),
        "UNAUTHORIZED"
      );
      await expectThrow(
        depositContract.withdraw(
          owner1,
          owner1,
          token.address,
          new BN(0),
          "0x",
          {
            from: exchange2
          }
        ),
        "UNAUTHORIZED"
      );
      await expectThrow(
        depositContract.transfer(owner1, owner2, token.address, new BN(0), {
          from: exchange2
        }),
        "UNAUTHORIZED"
      );
    });
  });

  describe("exchange behavior", () => {
    it("should be able to deposit tokens which transfer different amounts than specified", async () => {
      await createExchange();

      const amount = new BN(web3.utils.toWei("100", "ether"));
      const amountTransfered = amount.mul(new BN(99)).div(new BN(100));

      // Enable transfer mode that will transfer less than expected
      const testTokenAddress = await ctx.getTokenAddress("TEST");
      const TestToken = await ctx.contracts.TESTToken.at(testTokenAddress);
      await TestToken.setTestCase(
        await TestToken.TEST_DIFFERENT_TRANSFER_AMOUNT()
      );

      // Deposit without checking the balance change, the amount deposited is wrong
      {
        await ctx.deposit(owner1, owner1, "TEST", amount);
        const event = await ctx.assertEventEmitted(
          ctx.exchange,
          "DepositRequested"
        );
        assert(event.amount.eq(amount), "unexpected amount");
      }

      // Enable balance checking
      await ctx.depositContract.setCheckBalance(testTokenAddress, true);
      const event = await ctx.assertEventEmitted(
        ctx.depositContract,
        "CheckBalance"
      );
      assert.equal(event.token, testTokenAddress, "unexpected token address");
      assert.equal(event.checkBalance, true, "unexpected checkBalance");

      // Deposit again, but with checking the balance change, the amount deposited is correct
      {
        await ctx.deposit(owner2, owner2, "TEST", amount, {
          amountDepositedCanDiffer: true
        });
        const event = await ctx.assertEventEmitted(
          ctx.exchange,
          "DepositRequested"
        );
        assert(event.amount.eq(amountTransfered), "unexpected amount");
      }

      // Submit
      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();

      // Check balances inside the Merkle tree
      await ctx.checkOffchainBalance(
        owner1,
        "TEST",
        amount,
        "unexpected balance"
      );
      await ctx.checkOffchainBalance(
        owner2,
        "TEST",
        amountTransfered,
        "unexpected balance"
      );
    });
  });
});
