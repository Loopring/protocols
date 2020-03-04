import BN = require("bn.js");
import { Constants } from "loopringV3.js";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { Block, Deposit } from "./types";

contract("Operator 1", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;
  let exchangeId = 0;
  let operator: any;

  const numSubOperators = 4;
  let subOperators: number[] = [];

  interface TestDepositBlock {
    block: Block;
    deposits: Deposit[];
  }

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  beforeEach(async () => {
    exchangeId = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      true
    );
    exchange = exchangeTestUtil.exchange;
    operator = await exchangeTestUtil.contracts.Operator.new(exchange.address);
    await exchangeTestUtil.setOperatorContract(operator);

    subOperators = [];
    for (let i = 0; i < numSubOperators; i++) {
      const subOperator = await exchangeTestUtil.createOperator(
        exchangeId,
        exchangeTestUtil.testContext.operators[i]
      );
      subOperators.push(subOperator);
    }

    await exchangeTestUtil.commitDeposits(exchangeId);
    await exchangeTestUtil.verifyPendingBlocks(exchangeId);
  });

  const commitDepositBlock = async () => {
    await exchangeTestUtil.doRandomDeposit(exchangeId);
    const pendingDeposits = exchangeTestUtil.getPendingDeposits(exchangeId);
    const blocks = await exchangeTestUtil.commitDeposits(
      exchangeId,
      pendingDeposits
    );
    assert(blocks.length === 1);
    const block: TestDepositBlock = {
      block: blocks[0],
      deposits: pendingDeposits
    };
    return block;
  };

  const commitWithdrawalBlock = async (deposits: Deposit[]) => {
    for (const deposit of deposits) {
      exchangeTestUtil.requestWithdrawalOffchain(
        exchangeId,
        deposit.accountID,
        exchangeTestUtil.getTokenAddressFromID(deposit.tokenID),
        deposit.amount,
        "LRC",
        new BN(0),
        exchangeTestUtil.getRandomInt(2 ** Constants.NUM_BITS_LABEL)
      );
    }
    await exchangeTestUtil.commitOffchainWithdrawalRequests(exchangeId);
  };

  const getActiveOperator = async () => {
    // Write your active operator selection logic here
    return subOperators[exchangeTestUtil.getRandomInt(subOperators.length)];
  };

  describe("Operator 2", function() {
    this.timeout(0);

    it("Commit and Verify", async () => {
      for (let i = 0; i < 8; i++) {
        // Commit a deposit block
        await exchangeTestUtil.setActiveOperator(await getActiveOperator());
        const block = await commitDepositBlock();
        // Wait a bit
        await exchangeTestUtil.advanceBlockTimestamp(100);
      }
      // Verify all blocks
      await exchangeTestUtil.verifyPendingBlocks(exchangeId);
    });

    it("Distribute withdrawals", async () => {
      // Distribution on time
      {
        // Commit a deposit block
        const activeOperator = await getActiveOperator();
        const operatorOwner = exchangeTestUtil.getAccount(activeOperator).owner;
        await exchangeTestUtil.setActiveOperator(activeOperator);
        const blockA = await commitDepositBlock();
        await commitWithdrawalBlock(blockA.deposits);
        // Verify all blocks
        await exchangeTestUtil.verifyPendingBlocks(exchangeId);
        // Distribute the withdrawals on time
        await operator.distributeWithdrawals(
          blockA.block.blockIdx + 1,
          blockA.deposits.length,
          { from: operatorOwner }
        );
      }

      // Wait a bit
      await exchangeTestUtil.advanceBlockTimestamp(1000);

      // Distribution too late
      {
        // Commit another deposit block
        const activeOperator = await getActiveOperator();
        const operatorOwner = exchangeTestUtil.getAccount(activeOperator).owner;
        await exchangeTestUtil.setActiveOperator(activeOperator);
        const blockB = await commitDepositBlock();
        await commitWithdrawalBlock(blockB.deposits);
        // Verify all blocks
        await exchangeTestUtil.verifyPendingBlocks(exchangeId);
        // Distribute the withdrawals too late
        await exchangeTestUtil.advanceBlockTimestamp(
          exchangeTestUtil.MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS + 1
        );
        // This call can also happen directly on the Exchange contract
        await operator.distributeWithdrawals(
          blockB.block.blockIdx + 1,
          blockB.deposits.length,
          { from: operatorOwner }
        );
      }
    });

    it("Withdraw block fee", async () => {
      // Commit a deposit block
      const activeOperator = await getActiveOperator();
      const operatorOwner = exchangeTestUtil.getAccount(activeOperator).owner;
      await exchangeTestUtil.setActiveOperator(activeOperator);
      const blockA = await commitDepositBlock();
      // Verify all blocks
      await exchangeTestUtil.verifyPendingBlocks(exchangeId);
      // Withdraw the block fee
      await operator.withdrawBlockFee(blockA.block.blockIdx, {
        from: operatorOwner
      });
    });

    it("Revert", async () => {
      const activeOperator = await getActiveOperator();
      await exchangeTestUtil.setActiveOperator(activeOperator);
      // Commit a deposit block
      const blockA = await commitDepositBlock();
      // Wait until we can't submit the proof anymore
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_PROOF_GENERATION_TIME_IN_SECONDS + 1
      );
      // Revert the block
      await exchangeTestUtil.revertBlock(blockA.block.blockIdx);
      // Deposit extra LRC to stake for the exchange
      const depositer = exchangeTestUtil.testContext.operators[2];
      const stakeAmount = await exchangeTestUtil.loopringV3.revertFineLRC();
      await exchangeTestUtil.setBalanceAndApprove(
        depositer,
        "LRC",
        stakeAmount,
        exchangeTestUtil.loopringV3.address
      );
      await exchangeTestUtil.loopringV3.depositExchangeStake(
        exchangeId,
        stakeAmount,
        { from: depositer }
      );
      // Now commit the deposits again
      await exchangeTestUtil.commitDeposits(exchangeId, blockA.deposits);
      // Verify all blocks
      await exchangeTestUtil.verifyPendingBlocks(exchangeId);
    });
  });
});
