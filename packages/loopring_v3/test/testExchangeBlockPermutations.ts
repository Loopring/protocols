import BN = require("bn.js");
import { Constants } from "loopringV3.js";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { DepositInfo, RingInfo } from "./types";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchangeId = 0;

  const createRandomRing = () => {
    // Make sure the ring is valid
    const fillA = new BN(1).add(exchangeTestUtil.getRandomAmount());
    const fillB = new BN(1).add(exchangeTestUtil.getRandomAmount());
    const ring: RingInfo = {
      orderA: {
        tokenS: "WETH",
        tokenB: "GTO",
        amountS: fillA,
        amountB: fillB,
        buy: exchangeTestUtil.getRandomInt(2) > 0
      },
      orderB: {
        tokenS: "GTO",
        tokenB: "WETH",
        amountS: fillB,
        amountB: fillA,
        buy: exchangeTestUtil.getRandomInt(2) > 0
      }
    };
    return ring;
  };

  const doRandomDeposit = async () => {
    const orderOwners = exchangeTestUtil.testContext.orderOwners;
    const keyPair = exchangeTestUtil.getKeyPairEDDSA();
    const owner =
      orderOwners[Number(exchangeTestUtil.getRandomInt(orderOwners.length))];
    const amount = new BN(
      web3.utils.toWei(
        "" + exchangeTestUtil.getRandomInt(100000000) / 1000,
        "ether"
      )
    );
    const token = exchangeTestUtil.getTokenAddress("LRC");
    return await exchangeTestUtil.deposit(
      exchangeId,
      owner,
      keyPair.secretKey,
      keyPair.publicKeyX,
      keyPair.publicKeyY,
      token,
      amount
    );
  };

  const doRandomOnchainWithdrawal = async (depositInfo: DepositInfo) => {
    await exchangeTestUtil.requestWithdrawalOnchain(
      exchangeId,
      depositInfo.accountID,
      depositInfo.token,
      exchangeTestUtil.getRandomAmount(),
      depositInfo.owner
    );
  };

  const doRandomOffchainWithdrawal = async (depositInfo: DepositInfo) => {
    await exchangeTestUtil.requestWithdrawalOffchain(
      exchangeId,
      depositInfo.accountID,
      depositInfo.token,
      exchangeTestUtil.getRandomAmount(),
      "LRC",
      new BN(0)
    );
  };

  const doRandomInternalTransfer = async (
    depositInfoA: DepositInfo,
    depositInfoB: DepositInfo
  ) => {
    await exchangeTestUtil.requestInternalTransfer(
      exchangeId,
      depositInfoA.accountID,
      depositInfoB.accountID,
      depositInfoA.token,
      depositInfoA.amount.div(new BN(10)),
      depositInfoA.token,
      depositInfoA.amount.div(new BN(100))
    );
  };

  const createExchange = async (bDataAvailability: boolean) => {
    exchangeId = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      true,
      bDataAvailability
    );
  };

  const bVerify = true;
  const verify = async () => {
    if (bVerify) {
      await exchangeTestUtil.submitPendingBlocks(exchangeId);
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

    it("Ring Settlement", async () => {
      const bDataAvailabilities = [true, false];
      for (const bDataAvailability of bDataAvailabilities) {
        await createExchange(bDataAvailability);
        const blockSizes = exchangeTestUtil.ringSettlementBlockSizes;
        for (const blockSize of blockSizes) {
          const rings: RingInfo[] = [];
          for (let i = 0; i < blockSize; i++) {
            rings.push(createRandomRing());
          }
          for (const ring of rings) {
            await exchangeTestUtil.setupRing(ring);
            await exchangeTestUtil.sendRing(exchangeId, ring);
          }
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.commitRings(exchangeId);
        }
        await verify();
      }
    });

    it("Ring Settlement (dummy rings)", async () => {
      const bDataAvailabilities = [true];
      for (const bDataAvailability of bDataAvailabilities) {
        await createExchange(bDataAvailability);
        await exchangeTestUtil.commitDeposits(exchangeId);
        const blockSizes = exchangeTestUtil.ringSettlementBlockSizes;
        for (const blockSize of blockSizes) {
          for (let i = 0; i < blockSize; i++) {
            await exchangeTestUtil.sendRing(
              exchangeId,
              exchangeTestUtil.dummyRing
            );
          }
          await exchangeTestUtil.commitRings(exchangeId);
        }
        await verify();
      }
    });

    it("Deposit", async () => {
      await createExchange(false);
      const blockSizes = exchangeTestUtil.depositBlockSizes;
      for (const blockSize of blockSizes) {
        for (let i = 0; i < blockSize; i++) {
          await doRandomDeposit();
        }
        await exchangeTestUtil.commitDeposits(exchangeId);
      }
      await verify();
    });

    it("Onchain withdrawal", async () => {
      await createExchange(false);

      // Do some deposits
      const numDeposits = 8;
      const deposits: DepositInfo[] = [];
      for (let i = 0; i < numDeposits; i++) {
        deposits.push(await doRandomDeposit());
      }
      await exchangeTestUtil.commitDeposits(exchangeId);

      const blockSizes = exchangeTestUtil.onchainWithdrawalBlockSizes;
      for (const blockSize of blockSizes) {
        for (let i = 0; i < blockSize; i++) {
          const randomDeposit =
            deposits[exchangeTestUtil.getRandomInt(numDeposits)];
          await doRandomOnchainWithdrawal(randomDeposit);
        }
        await exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeId);
      }
      await verify();
    });

    it("Offchain withdrawal", async () => {
      const bDataAvailabilities = [true, false];
      for (const bDataAvailability of bDataAvailabilities) {
        await createExchange(bDataAvailability);

        // Do some deposits
        const numDeposits = 8;
        const deposits: DepositInfo[] = [];
        for (let i = 0; i < numDeposits; i++) {
          deposits.push(await doRandomDeposit());
        }
        await exchangeTestUtil.commitDeposits(exchangeId);

        const blockSizes = exchangeTestUtil.offchainWithdrawalBlockSizes;
        for (const blockSize of blockSizes) {
          for (let i = 0; i < blockSize; i++) {
            const randomDeposit =
              deposits[exchangeTestUtil.getRandomInt(numDeposits)];
            await doRandomOffchainWithdrawal(randomDeposit);
          }
          await exchangeTestUtil.commitOffchainWithdrawalRequests(exchangeId);
        }
        await verify();
      }
    });

    it("Internal transfer", async () => {
      const bDataAvailabilities = [true, false];
      for (const bDataAvailability of bDataAvailabilities) {
        await createExchange(bDataAvailability);

        // Do some deposits
        const numDeposits = 8;
        const deposits: DepositInfo[] = [];
        for (let i = 0; i < numDeposits; i++) {
          deposits.push(await doRandomDeposit());
        }
        await exchangeTestUtil.commitDeposits(exchangeId);

        const blockSizes = exchangeTestUtil.transferBlockSizes;
        for (const blockSize of blockSizes) {
          for (let i = 0; i < blockSize; i++) {
            const randomDepositA =
              deposits[exchangeTestUtil.getRandomInt(numDeposits)];
            const randomDepositB =
              deposits[exchangeTestUtil.getRandomInt(numDeposits)];
            await doRandomInternalTransfer(randomDepositA, randomDepositB);
          }
          await exchangeTestUtil.commitInternalTransfers(exchangeId);
        }
        await verify();
      }
    });
  });
});
