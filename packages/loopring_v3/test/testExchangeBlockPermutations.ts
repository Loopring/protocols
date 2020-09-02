import BN = require("bn.js");
import { Constants } from "loopringV3.js";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { Deposit, SpotTrade, AuthMethod } from "./types";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchangeId = 0;

  const createRandomRing = () => {
    // Make sure the ring is valid
    const fillA = new BN(1).add(exchangeTestUtil.getRandomAmount());
    const fillB = new BN(1).add(exchangeTestUtil.getRandomAmount());
    const ring: SpotTrade = {
      orderA: {
        tokenS: "WETH",
        tokenB: "GTO",
        amountS: fillA,
        amountB: fillB,
        fillAmountBorS: exchangeTestUtil.getRandomInt(2) > 0
      },
      orderB: {
        tokenS: "GTO",
        tokenB: "WETH",
        amountS: fillB,
        amountB: fillA,
        fillAmountBorS: exchangeTestUtil.getRandomInt(2) > 0
      }
    };
    return ring;
  };

  const doRandomDeposit = async () => {
    const orderOwners = exchangeTestUtil.testContext.orderOwners;
    const owner =
      orderOwners[Number(exchangeTestUtil.getRandomInt(orderOwners.length))];
    const amount = new BN(
      web3.utils.toWei(
        "" + exchangeTestUtil.getRandomInt(100000000) / 1000,
        "ether"
      )
    );
    const token = exchangeTestUtil.getTokenAddress("LRC");
    return await exchangeTestUtil.deposit(owner, owner, token, amount);
  };

  const doRandomOnchainWithdrawal = async (deposit: Deposit) => {
    await exchangeTestUtil.requestWithdrawal(
      deposit.owner,
      deposit.token,
      exchangeTestUtil.getRandomAmount(),
      "ETH",
      new BN(0),
      { authMethod: AuthMethod.FORCE }
    );
  };

  const doRandomOffchainWithdrawal = async (deposit: Deposit) => {
    await exchangeTestUtil.requestWithdrawal(
      deposit.owner,
      deposit.token,
      deposit.amount,
      "LRC",
      new BN(0)
    );
  };

  const doRandomInternalTransfer = async (
    depositA: Deposit,
    depositB: Deposit
  ) => {
    await exchangeTestUtil.transfer(
      depositA.owner,
      depositB.owner,
      depositA.token,
      depositA.amount.div(new BN(10)),
      depositA.token,
      depositA.amount.div(new BN(100))
    );
  };

  const createExchange = async (deterministic: boolean = false) => {
    exchangeId = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      {deterministic}
    );
  };

  const bVerify = true;
  const verify = async () => {
    if (bVerify) {
      await exchangeTestUtil.submitPendingBlocks();
    }
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  describe("Permutations", function() {
    this.timeout(0);

    it("Spot trade", async () => {
      await createExchange();
      const blockSizes = exchangeTestUtil.blockSizes;
      for (const blockSize of blockSizes) {
        const rings: SpotTrade[] = [];
        for (let i = 0; i < blockSize; i++) {
          rings.push(createRandomRing());
        }
        for (const ring of rings) {
          await exchangeTestUtil.setupRing(ring);
          await exchangeTestUtil.sendRing(ring);
        }
        await exchangeTestUtil.submitTransactions();
      }
      await verify();
    });

    it("Deposit", async () => {
      await createExchange();
      const blockSizes = exchangeTestUtil.blockSizes;
      for (const blockSize of blockSizes) {
        for (let i = 0; i < blockSize; i++) {
          await doRandomDeposit();
        }
        await exchangeTestUtil.submitTransactions();
      }
      await verify();
    });

    it("Withdrawal", async () => {
      await createExchange();

      const blockSizes = exchangeTestUtil.blockSizes;
      for (const blockSize of blockSizes) {
        // Do some deposit
        const deposits: Deposit[] = [];
        for (let i = 0; i < blockSize; i++) {
          deposits.push(await doRandomDeposit());
        }
        for (let i = 0; i < blockSize; i++) {
          await doRandomOffchainWithdrawal(deposits[i]);
        }
        await exchangeTestUtil.submitTransactions();
      }
      await verify();
    });

    it("Transfer", async () => {
      await createExchange();

      // Do some deposits
      const numDeposits = 8;
      const deposits: Deposit[] = [];
      for (let i = 0; i < numDeposits; i++) {
        deposits.push(await doRandomDeposit());
      }
      await exchangeTestUtil.submitTransactions();

      const blockSizes = exchangeTestUtil.blockSizes;
      for (const blockSize of blockSizes) {
        for (let i = 0; i < blockSize; i++) {
          const randomDepositA =
            deposits[exchangeTestUtil.getRandomInt(numDeposits)];
          const randomDepositB =
            deposits[exchangeTestUtil.getRandomInt(numDeposits)];
          await doRandomInternalTransfer(randomDepositA, randomDepositB);
        }
        await exchangeTestUtil.submitTransactions();
      }
      await verify();
    });

    it("All transaction types in a single block", async () => {
      const ringA: SpotTrade = {
        orderA: {
          tokenS: "ETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("3", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[0]
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "ETH",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("2", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[1]
        },
        expected: {
          orderA: {
            filledFraction: 1.0,
            spread: new BN(web3.utils.toWei("1", "ether"))
          },
          orderB: { filledFraction: 1.0 }
        }
      };
      const ringB: SpotTrade = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("110", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[2]
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[3]
        },
        expected: {
          orderA: {
            filledFraction: 1.0,
            spread: new BN(web3.utils.toWei("10", "ether"))
          },
          orderB: { filledFraction: 1.0 }
        }
      };

      await exchangeTestUtil.setupRing(ringA);
      await exchangeTestUtil.setupRing(ringB);
      await exchangeTestUtil.sendRing(ringA);
      await exchangeTestUtil.sendRing(ringB);

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("2.9", "ether"));
      const fee = new BN(web3.utils.toWei("12.3", "ether"));

      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const ownerB = exchangeTestUtil.testContext.orderOwners[1];
      const ownerC = exchangeTestUtil.testContext.orderOwners[2];
      const ownerD = exchangeTestUtil.testContext.orderOwners[3];
      const ownerE = exchangeTestUtil.testContext.orderOwners[4];
      const ownerF = exchangeTestUtil.testContext.orderOwners[5];

      // Update AMM
      await exchangeTestUtil.requestAmmUpdate(
        ownerA,
        token,
        15,
        new BN(123),
        {authMethod: AuthMethod.APPROVE}
      );

      // Do a transfer
      await exchangeTestUtil.transfer(
        ownerA,
        ownerB,
        token,
        amount,
        feeToken,
        fee,
        {authMethod: AuthMethod.ECDSA}
      );

      // Do a withdrawal
      await exchangeTestUtil.requestWithdrawal(
        ownerB,
        token,
        amount,
        feeToken,
        new BN(0)
      );

      // Do an account update
      await exchangeTestUtil.requestAccountUpdate(
        ownerB,
        "ETH",
        new BN(0),
        exchangeTestUtil.getKeyPairEDDSA()
      );

      await exchangeTestUtil.submitTransactions();
      await verify();
    });

    it("Benchmark (trades)", async () => {
      await createExchange(true);

      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const ownerB = exchangeTestUtil.testContext.orderOwners[1];

      const tokenA = "ETH";
      const tokenB = "LRC";

      const amountA = new BN(web3.utils.toWei("1.0", "ether"));
      const amountB = new BN(web3.utils.toWei("1.0", "ether"));

      // Fund ownerA
      await exchangeTestUtil.deposit(ownerA, ownerA, tokenA, amountA);
      // Fund ownerB
      await exchangeTestUtil.deposit(ownerB, ownerB, tokenB, amountB);

      await exchangeTestUtil.submitTransactions();
      await verify();

      const blockSizes = [8, 16, 32];
      for (const blockSize of blockSizes) {
        const rings: SpotTrade[] = [];
        for (let i = 0; i < blockSize; i++) {
          const ring: SpotTrade = {
            orderA: {
              tokenS: tokenA,
              tokenB: tokenB,
              amountS: new BN(web3.utils.toWei("0.000001", "ether")),
              amountB: new BN(web3.utils.toWei("0.000001", "ether")),
              owner: ownerA
            },
            orderB: {
              tokenS: tokenB,
              tokenB: tokenA,
              amountS: new BN(web3.utils.toWei("0.000001", "ether")),
              amountB: new BN(web3.utils.toWei("0.000001", "ether")),
              owner: ownerB
            },
            expected: {
              orderA: {
                filledFraction: 1.0,
                spread: new BN(web3.utils.toWei("0", "ether"))
              },
              orderB: { filledFraction: 1.0 }
            }
          };
          rings.push(ring);
        }
        for (const ring of rings) {
          await exchangeTestUtil.setupRing(ring, true, true, false, false);
          await exchangeTestUtil.sendRing(ring);
        }
        await exchangeTestUtil.submitTransactions(blockSize);
        await verify();
      }
      //await exchangeTestUtil.submitTransactions(8);
      //await verify();
    });
  });
});
