import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { Block, RingInfo } from "./types";

contract("Exchange", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;
  let loopringV3: any;
  let exchangeId = 0;

  const depositStakeChecked = async (amount: BN, owner: string) => {
    const token = "LRC";
    const balanceOwnerBefore = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractBefore = await exchangeTestUtil.getOnchainBalance(loopringV3.address, token);
    const stakeBefore = await exchange.getStake();
    const totalStakeBefore = await loopringV3.totalStake();

    await loopringV3.depositStake(exchangeId, amount, {from: owner});

    const balanceOwnerAfter = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractAfter = await exchangeTestUtil.getOnchainBalance(loopringV3.address, token);
    const stakeAfter = await exchange.getStake();
    const totalStakeAfter = await loopringV3.totalStake();

    assert(balanceOwnerBefore.eq(balanceOwnerAfter.add(amount)),
           "Token balance of owner should be decreased by amount");
    assert(balanceContractAfter.eq(balanceContractBefore.add(amount)),
           "Token balance of contract should be increased by amount");
    assert(stakeAfter.eq(stakeBefore.add(amount)),
           "Stake should be increased by amount");
    assert(totalStakeAfter.eq(totalStakeBefore.add(amount)),
           "Total stake should be increased by amount");

    // Get the StakeDeposited event
    const eventArr: any = await exchangeTestUtil.getEventsFromContract(
      loopringV3, "StakeDeposited", web3.eth.blockNumber,
    );
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.exchangeId, eventObj.args.amount];
    });
    assert.equal(items.length, 1, "A single StakeDeposited event should have been emitted");
    assert.equal(items[0][0].toNumber(), exchangeId, "exchangeId should match");
    assert(items[0][1].eq(amount), "amount should match");
  };

  const withdrawStakeChecked = async (recipient: string, amount: BN) => {
    const token = "LRC";
    const balanceOwnerBefore = await exchangeTestUtil.getOnchainBalance(recipient, token);
    const balanceContractBefore = await exchangeTestUtil.getOnchainBalance(loopringV3.address, token);
    const stakeBefore = await exchange.getStake();
    const totalStakeBefore = await loopringV3.totalStake();

    await exchange.withdrawStake(recipient, {from: exchangeTestUtil.exchangeOwner});

    const balanceOwnerAfter = await exchangeTestUtil.getOnchainBalance(recipient, token);
    const balanceContractAfter = await exchangeTestUtil.getOnchainBalance(loopringV3.address, token);
    const stakeAfter = await exchange.getStake();
    const totalStakeAfter = await loopringV3.totalStake();

    assert(balanceOwnerAfter.eq(balanceOwnerBefore.add(amount)),
           "Token balance of owner should be increased by amount");
    assert(balanceContractBefore.eq(balanceContractAfter.add(amount)),
           "Token balance of contract should be decreased by amount");
    assert(stakeBefore.eq(stakeAfter.add(amount)),
           "Stake should be decreased by amount");
    assert(totalStakeAfter.eq(totalStakeBefore.sub(amount)),
           "Total stake should be decreased by amount");

    // Get the StakeWithdrawn event
    const eventArr: any = await exchangeTestUtil.getEventsFromContract(
      loopringV3, "StakeWithdrawn", web3.eth.blockNumber,
    );
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.exchangeId, eventObj.args.amount];
    });
    assert.equal(items.length, 1, "A single StakeWithdrawn event should have been emitted");
    assert.equal(items[0][0].toNumber(), exchangeId, "exchangeId should match");
    assert(items[0][1].eq(amount), "amount should match");
  };

  const createExchange = async (bSetupTestState: boolean = true) => {
    exchangeId = await exchangeTestUtil.createExchange(exchangeTestUtil.testContext.stateOwners[0], true);
    exchange = exchangeTestUtil.exchange;
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    loopringV3 = exchangeTestUtil.loopringV3;
  });

  describe("Shutdown", function() {
    this.timeout(0);

    it("Withdraw exchange stake", async () => {
      await createExchange();

      // Deposit some LRC to stake for the exchange
      const depositer = exchangeTestUtil.testContext.operators[2];
      const stakeAmount = new BN(web3.utils.toWei("1234567", "ether"));
      await exchangeTestUtil.setBalanceAndApprove(depositer, "LRC", stakeAmount, loopringV3.address);

      // Stake it
      await depositStakeChecked(stakeAmount, depositer);

      // Do a trade so the trading history/nonce for some accounts don't have default values
      const ring: RingInfo = {
        orderA:
          {
            realmID: exchangeId,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("1000", "ether")),
          },
        orderB:
          {
            realmID: exchangeId,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("900", "ether")),
          },
        expected: {
          orderA: { filledFraction: 1.0, margin: new BN(0) },
          orderB: { filledFraction: 1.0 },
        },
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
      const depositInfo = await exchangeTestUtil.deposit(exchangeId, owner,
                                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                         token, amount);

      // Try to withdraw before the exchange is shutdown
      await expectThrow(
        exchange.withdrawStake(exchangeTestUtil.exchangeOwner, {from: exchangeTestUtil.exchangeOwner}),
        "EXCHANGE_NOT_SHUTDOWN",
      );

      // Shut down the exchange
      await exchange.shutdown({from: exchangeTestUtil.exchangeOwner});

      // Verify all blocks until shutdown
      await exchangeTestUtil.verifyPendingBlocks(exchangeId);

      // Try to withdraw before all deposits are processed
      await expectThrow(
        exchange.withdrawStake(exchangeTestUtil.exchangeOwner, {from: exchangeTestUtil.exchangeOwner}),
        "DEPOSITS_NOT_PROCESSED",
      );

      // Make sure all deposits are done
      await exchangeTestUtil.commitDeposits(exchangeId);

      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(exchangeId);

      // Try to withdraw before the block is finalized
      await expectThrow(
        exchange.withdrawStake(exchangeTestUtil.exchangeOwner, {from: exchangeTestUtil.exchangeOwner}),
        "MERKLE_ROOT_NOT_REVERTED",
      );

      const currentBlockIdx = (await exchange.getBlockHeight()).toNumber();
      const exchangeState = await exchangeTestUtil.loadRealm(exchangeId, currentBlockIdx);

      // Do all withdrawal requests to completely reset the merkle tree
      const accountsKeys: string[] = Object.keys(exchangeState.accounts);
      for (const accountKey of accountsKeys) {
        const account = exchangeState.accounts[Number(accountKey)];
        let bAccountReset = false;
        for (const tokenID of Object.keys(account.balances)) {
          const balanceValue = account.balances[Number(tokenID)];
          let bTradeHistoryNeedsReset = false;
          for (const orderID of Object.keys(balanceValue.tradeHistory)) {
            const tradeHistoryValue = balanceValue.tradeHistory[Number(orderID)];
            if (tradeHistoryValue.filled.gt(new BN(0)) || tradeHistoryValue.orderID > 0) {
              bTradeHistoryNeedsReset = true;
            }
          }
          if (balanceValue.balance.gt(new BN(0)) || bTradeHistoryNeedsReset) {
            bAccountReset = true;
            const tokenAddress = exchangeTestUtil.tokenIDToAddressMap.get(Number(tokenID));
            await exchangeTestUtil.requestShutdownWithdrawal(
              exchangeId, account.accountID, tokenAddress, balanceValue.balance,
            );
          }
        }
        if (!bAccountReset && (account.publicKeyX !== "0" || account.publicKeyY !== "0" || account.nonce !== 0)) {
          await exchangeTestUtil.requestShutdownWithdrawal(
            exchangeId, account.accountID, exchangeTestUtil.zeroAddress, new BN(0),
          );
        }
      }

      await exchangeTestUtil.commitShutdownWithdrawalRequests(exchangeId);

       // Try to withdraw before the block is finalized
      await expectThrow(
        exchange.withdrawStake(exchangeTestUtil.exchangeOwner, {from: exchangeTestUtil.exchangeOwner}),
        "BLOCK_NOT_FINALIZED",
      );

      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(exchangeId);

      // Try to withdraw too early
      await expectThrow(
        exchange.withdrawStake(exchangeTestUtil.exchangeOwner, {from: exchangeTestUtil.exchangeOwner}),
        "TOO_EARLY",
      );

      // Wait a bit until MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS seconds have passed
      await exchangeTestUtil.advanceBlockTimestamp(exchangeTestUtil.MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS + 1);

      // Withdraw the exchange stake
      await withdrawStakeChecked(exchangeTestUtil.exchangeOwner, stakeAmount);
    });

    it("Incomplete shutdown", async () => {
      await createExchange();

      // Make sure all deposits are done
      await exchangeTestUtil.commitDeposits(exchangeId);

      // Deposit some LRC to stake for the exchange
      const depositer = exchangeTestUtil.testContext.operators[2];
      const stakeAmount = new BN(web3.utils.toWei("1234567", "ether"));
      await exchangeTestUtil.setBalanceAndApprove(depositer, "LRC", stakeAmount, loopringV3.address);

      // Stake it
      await depositStakeChecked(stakeAmount, depositer);

      // Shut down the exchange
      await exchange.shutdown({from: exchangeTestUtil.exchangeOwner});

      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(exchangeId);

      // Wait for 2 days
      await exchangeTestUtil.advanceBlockTimestamp(2 * 24 * 3600);

      // Withdraw the exchange stake
      await expectThrow(
        exchange.withdrawStake(exchangeTestUtil.exchangeOwner, {from: exchangeTestUtil.exchangeOwner}),
        "MERKLE_ROOT_NOT_REVERTED",
      );

      // Burn the stake
      await exchange.burnStake();
    });

  });
});
