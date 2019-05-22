import BN = require("bn.js");
import * as constants from "./constants";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { DepositInfo, RingInfo } from "./types";

contract("Exchange", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;
  let exchangeId = 0;

  const createRandomRing = () => {
    const amount1 = exchangeTestUtil.getRandomAmount();
    const amount2 = exchangeTestUtil.getRandomAmount();
    const ring: RingInfo = {
      orderA:
        {
          realmID: exchangeId,
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: amount1,
          amountB: amount2,
        },
      orderB:
        {
          realmID: exchangeId,
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: amount2,
          amountB: amount1,
        },
    };
    return ring;
  };

  const doRandomDeposit = async () => {
    const orderOwners = exchangeTestUtil.testContext.orderOwners;
    const keyPair = exchangeTestUtil.getKeyPairEDDSA();
    const owner = orderOwners[Number(exchangeTestUtil.getRandomInt(orderOwners.length))];
    const amount = new BN(web3.utils.toWei("" + exchangeTestUtil.getRandomInt(100000000) / 1000, "ether"));
    const token = exchangeTestUtil.getTokenAddress("LRC");
    return await exchangeTestUtil.deposit(exchangeId, owner,
                                          keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                          token, amount);
  };

  const doRandomOnchainWithdrawal = async (depositInfo: DepositInfo) => {
    await exchangeTestUtil.requestWithdrawalOnchain(
      exchangeId,
      depositInfo.accountID,
      depositInfo.token,
      exchangeTestUtil.getRandomAmount(),
      depositInfo.owner,
    );
  };

  const doRandomOffchainWithdrawal = (depositInfo: DepositInfo) => {
    exchangeTestUtil.requestWithdrawalOffchain(
      exchangeId,
      depositInfo.accountID,
      depositInfo.token,
      exchangeTestUtil.getRandomAmount(),
      "LRC",
      new BN(0),
      0,
      exchangeTestUtil.wallets[exchangeId][0].walletAccountID,
    );
  };

  const doRandomOrderCancellation = (depositInfo: DepositInfo) => {
    exchangeTestUtil.cancelOrderID(
      exchangeId,
      depositInfo.accountID,
      exchangeTestUtil.getRandomInt(exchangeTestUtil.MAX_NUM_TOKENS),
      exchangeTestUtil.getRandomInt(2 ** constants.TREE_DEPTH_TRADING_HISTORY),
      exchangeTestUtil.wallets[exchangeId][0].walletAccountID,
      1,
      new BN(0),
      0,
    );
  };

  const createExchange = async (bDataAvailability: boolean) => {
    exchangeId = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0], true, bDataAvailability,
    );
  };

  const bVerify = true;
  const verify = async () => {
    if (bVerify) {
      await exchangeTestUtil.verifyPendingBlocks(exchangeId);
    }
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
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
          const randomDeposit = deposits[exchangeTestUtil.getRandomInt(numDeposits)];
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
            const randomDeposit = deposits[exchangeTestUtil.getRandomInt(numDeposits)];
            await doRandomOffchainWithdrawal(randomDeposit);
          }
          await exchangeTestUtil.commitOffchainWithdrawalRequests(exchangeId);
        }
        await verify();
      }
    });

    it("Order Cancellation", async () => {
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

        const blockSizes = exchangeTestUtil.orderCancellationBlockSizes;
        for (const blockSize of blockSizes) {
          for (let i = 0; i < blockSize; i++) {
            const randomDeposit = deposits[exchangeTestUtil.getRandomInt(numDeposits)];
            await doRandomOrderCancellation(randomDeposit);
          }
          await exchangeTestUtil.commitCancels(exchangeId);
        }
        await verify();
      }
    });

  });
});
