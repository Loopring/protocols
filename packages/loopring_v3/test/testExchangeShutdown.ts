import BN = require("bn.js");
import { Constants } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { Block, RingInfo } from "./types";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;
  let loopringV3: any;
  let exchangeId = 0;

  const createExchange = async (bSetupTestState: boolean = true) => {
    exchangeId = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      true
    );
    exchange = exchangeTestUtil.exchange;
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    loopringV3 = exchangeTestUtil.loopringV3;
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  describe("Shutdown", function() {
    this.timeout(0);

    it("Withdraw exchange stake", async () => {
      await createExchange();

      const currentStakeAmount = await exchange.getExchangeStake();

      // Deposit some LRC to stake for the exchange
      const depositer = exchangeTestUtil.testContext.operators[2];
      const stakeAmount = new BN(web3.utils.toWei("1234567", "ether"));
      await exchangeTestUtil.setBalanceAndApprove(
        depositer,
        "LRC",
        stakeAmount,
        loopringV3.address
      );

      // Stake it
      await exchangeTestUtil.depositExchangeStakeChecked(
        stakeAmount,
        depositer
      );

      // Do a trade so the trading history/nonce for some accounts don't have default values
      const ring: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether"))
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether"))
        },
        expected: {
          orderA: { filledFraction: 1.0, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };
      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeId, ring);
      await exchangeTestUtil.commitDeposits(exchangeId);
      await exchangeTestUtil.commitRings(exchangeId);

      // Do a deposit
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const amount = new BN(web3.utils.toWei("3", "ether"));
      const token = exchangeTestUtil.getTokenAddress("ETH");
      const depositInfo = await exchangeTestUtil.deposit(
        exchangeId,
        owner,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        token,
        amount
      );

      // Try to withdraw before the exchange is shutdown
      await expectThrow(
        exchange.withdrawExchangeStake(exchangeTestUtil.exchangeOwner, {
          from: exchangeTestUtil.exchangeOwner
        }),
        "EXCHANGE_NOT_SHUTDOWN"
      );

      // Verify all blocks until shutdown
      await exchangeTestUtil.submitPendingBlocks(exchangeId);

      // Shut down the exchange
      await exchange.shutdown({ from: exchangeTestUtil.exchangeOwner });

      // Try to withdraw before all deposits are processed
      await expectThrow(
        exchange.withdrawExchangeStake(exchangeTestUtil.exchangeOwner, {
          from: exchangeTestUtil.exchangeOwner
        }),
        "DEPOSITS_NOT_PROCESSED"
      );

      // Make sure all deposits are done
      await exchangeTestUtil.commitDeposits(exchangeId);
      // Verify the block
      await exchangeTestUtil.submitPendingBlocks(exchangeId);

      // Try to withdraw before the exchange is completely reverted to the
      // initial state.
      await expectThrow(
        exchange.withdrawExchangeStake(exchangeTestUtil.exchangeOwner, {
          from: exchangeTestUtil.exchangeOwner
        }),
        "MERKLE_ROOT_NOT_REVERTED"
      );

      const exchangeState = await exchangeTestUtil.loadExchangeState(
        exchangeId
      );

      // Do all withdrawal requests to completely reset the merkle tree
      for (
        let accountID = 0;
        accountID < exchangeState.accounts.length;
        accountID++
      ) {
        const account = exchangeState.accounts[accountID];
        let bAccountReset = false;
        for (const tokenID of Object.keys(account.balances)) {
          const balanceValue = account.balances[Number(tokenID)];
          let bTradeHistoryNeedsReset = false;
          for (const orderID of Object.keys(balanceValue.tradeHistory)) {
            const tradeHistoryValue =
              balanceValue.tradeHistory[Number(orderID)];
            if (
              tradeHistoryValue.filled.gt(new BN(0)) ||
              tradeHistoryValue.orderID > 0
            ) {
              bTradeHistoryNeedsReset = true;
            }
          }
          if (balanceValue.balance.gt(new BN(0)) || bTradeHistoryNeedsReset) {
            bAccountReset = true;
            const tokenAddress = exchangeTestUtil.tokenIDToAddressMap.get(
              Number(tokenID)
            );
            await exchangeTestUtil.requestShutdownWithdrawal(
              exchangeId,
              accountID,
              tokenAddress,
              balanceValue.balance
            );
          }
        }
        if (
          !bAccountReset &&
          (account.publicKeyX !== "0" ||
            account.publicKeyY !== "0" ||
            account.nonce !== 0)
        ) {
          await exchangeTestUtil.requestShutdownWithdrawal(
            exchangeId,
            accountID,
            Constants.zeroAddress,
            new BN(0)
          );
        }
      }

      await exchangeTestUtil.commitShutdownWithdrawalRequests(exchangeId);
      await exchangeTestUtil.submitPendingBlocks(exchangeId);

      // Withdraw the exchange stake
      await exchangeTestUtil.withdrawExchangeStakeChecked(
        exchangeTestUtil.exchangeOwner,
        currentStakeAmount.add(stakeAmount)
      );
    });

    it("Incomplete shutdown", async () => {
      await createExchange();

      // Make sure all deposits are done
      await exchangeTestUtil.commitDeposits(exchangeId);

      // Deposit some LRC to stake for the exchange
      const depositer = exchangeTestUtil.testContext.operators[2];
      const stakeAmount = new BN(web3.utils.toWei("1234567", "ether"));
      await exchangeTestUtil.setBalanceAndApprove(
        depositer,
        "LRC",
        stakeAmount,
        loopringV3.address
      );

      // Stake it
      await exchangeTestUtil.depositExchangeStakeChecked(
        stakeAmount,
        depositer
      );

      // Shut down the exchange
      await exchange.shutdown({ from: exchangeTestUtil.exchangeOwner });

      // Verify the block
      await exchangeTestUtil.submitPendingBlocks(exchangeId);

      // Wait for 2 days
      await exchangeTestUtil.advanceBlockTimestamp(2 * 24 * 3600);

      // Withdraw the exchange stake
      await expectThrow(
        exchange.withdrawExchangeStake(exchangeTestUtil.exchangeOwner, {
          from: exchangeTestUtil.exchangeOwner
        }),
        "MERKLE_ROOT_NOT_REVERTED"
      );

      // Burn the stake
      await exchange.burnExchangeStake();
    });

    it("Should not be able to shutdown when already shutdown", async () => {
      await createExchange();

      // Shut down the exchange
      await exchange.shutdown({ from: exchangeTestUtil.exchangeOwner });

      // Try to shut down again
      await expectThrow(
        exchange.shutdown({ from: exchangeTestUtil.exchangeOwner }),
        "ALREADY_SHUTDOWN"
      );
    });
  });
});
