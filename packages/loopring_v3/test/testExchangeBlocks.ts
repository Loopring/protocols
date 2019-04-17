import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { DepositInfo, WithdrawalRequest } from "./types";

contract("Exchange", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;
  let exchangeId = 0;
  let exchange: any;
  let loopring: any;

  const doRandomDeposit = async () => {
    // Change the deposit fee
    const fees = await exchange.getFees();
    await exchange.setFees(
      fees._accountCreationFeeETH,
      fees._accountUpdateFeeETH,
      fees._depositFeeETH.mul(new BN(2)),
      fees._withdrawalFeeETH,
      {from: exchangeTestUtil.exchangeOwner},
    );

    const orderOwners = exchangeTestUtil.testContext.orderOwners;
    const keyPair = exchangeTestUtil.getKeyPairEDDSA();
    const owner = orderOwners[Number(exchangeTestUtil.getRandomInt(orderOwners.length))];
    const amount = new BN(web3.utils.toWei("" + Math.random() * 1000, "ether"));
    const token = exchangeTestUtil.getTokenAddress("LRC");
    return await exchangeTestUtil.deposit(exchangeId, owner,
                                          keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                          token, amount);
  };

  const doRandomOnchainWithdrawal = async (depositInfo: DepositInfo) => {
    // Change the withdrawal fee
    const fees = await exchange.getFees();
    await exchange.setFees(
      fees._accountCreationFeeETH,
      fees._accountUpdateFeeETH,
      fees._depositFeeETH,
      fees._withdrawalFeeETH.mul(new BN(2)),
      {from: exchangeTestUtil.exchangeOwner},
    );

    return await exchangeTestUtil.requestWithdrawalOnchain(
      exchangeId,
      depositInfo.accountID,
      depositInfo.token,
      new BN(Math.random() * 1000),
      depositInfo.owner,
    );
  };

  const doRandomOffchainWithdrawal = (depositInfo: DepositInfo) => {
    exchangeTestUtil.requestWithdrawalOffchain(
      exchangeId,
      depositInfo.accountID,
      depositInfo.token,
      new BN(Math.random() * 1000),
      "LRC",
      new BN(0),
      0,
      exchangeTestUtil.wallets[exchangeId][0].walletAccountID,
    );
  };

  const withdrawBlockFeeChecked = async (blockIdx: number, operator: string, totalBlockFee: BN,
                                         expectedBlockFee: BN, allowedDelta: BN = new BN(0)) => {
    const token = "ETH";
    const balanceOperatorBefore = await exchangeTestUtil.getOnchainBalance(operator, token);
    const balanceContractBefore = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const balanceBurnedBefore = await exchangeTestUtil.getOnchainBalance(loopring.address, token);

    await exchange.withdrawBlockFee(blockIdx, {from: operator, gasPrice: 0});

    const balanceOperatorAfter = await exchangeTestUtil.getOnchainBalance(operator, token);
    const balanceContractAfter = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const balanceBurnedAfter = await exchangeTestUtil.getOnchainBalance(loopring.address, token);

    const expectedBurned = totalBlockFee.sub(expectedBlockFee);

    assert(balanceOperatorAfter.sub(balanceOperatorBefore.add(expectedBlockFee)).abs().lte(allowedDelta),
           "Token balance of operator should be increased by rewarded block fee");
    assert(balanceContractAfter.eq(balanceContractBefore.sub(totalBlockFee)),
           "Token balance of exchange should be decreased by total block fee");
    assert(balanceBurnedAfter.sub(balanceBurnedBefore.add(expectedBurned)).abs().lte(allowedDelta),
           "Burned amount should be increased by burned block fee");

    // Get the BlockFeeWithdrawn event
    const eventArr: any = await exchangeTestUtil.getEventsFromContract(
      exchange, "BlockFeeWithdrawn", web3.eth.blockNumber,
    );
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.blockIdx, eventObj.args.amount];
    });
    assert.equal(items[0][0].toNumber(), blockIdx, "Block idx in event not correct");
    assert(items[0][1].eq(totalBlockFee), "Block fee different than expected");
  };

  const createExchange = async () => {
    exchangeId = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
    );
    exchange = exchangeTestUtil.exchange;
    loopring = exchangeTestUtil.loopringV3;
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  describe("Blocks", function() {
    this.timeout(0);

    it("Withdraw block fee (deposit block - in time)", async () => {
      await createExchange();
      await exchangeTestUtil.commitDeposits(exchangeId);
      await exchangeTestUtil.verifyPendingBlocks(exchangeId);

      // Do some deposits
      const numDeposits = exchangeTestUtil.depositBlockSizes[0];
      const deposits: DepositInfo[] = [];
      let blockFee = new BN(0);
      for (let i = 0; i < numDeposits; i++) {
        const deposit = await doRandomDeposit();
        deposits.push(deposit);
        blockFee = blockFee.add(deposit.fee);
      }
      await exchangeTestUtil.commitDeposits(exchangeId);
      const blockIdx = await exchange.getBlockHeight();

      // Try to withdraw before the block is finalized
      await expectThrow(
        exchange.withdrawBlockFee(blockIdx, {from: exchangeTestUtil.exchangeOperator}),
        "BLOCK_NOT_FINALIZED",
      );

      // Finalize the block containing the deposits
      await exchangeTestUtil.verifyPendingBlocks(exchangeId);

      // Withdraw the block fee
      await withdrawBlockFeeChecked(
        blockIdx, exchangeTestUtil.exchangeOperator,
        blockFee, blockFee,
      );

      // Try to withdraw again
      await expectThrow(
        exchange.withdrawBlockFee(blockIdx, {from: exchangeTestUtil.exchangeOperator}),
        "FEE_WITHDRAWN_ALREADY",
      );
    });

    it("Withdraw block fee (deposit block - fined)", async () => {
      await createExchange();
      await exchangeTestUtil.commitDeposits(exchangeId);
      await exchangeTestUtil.verifyPendingBlocks(exchangeId);

      // Do some deposits
      const numDeposits = exchangeTestUtil.depositBlockSizes[0];
      const deposits: DepositInfo[] = [];
      let blockFee = new BN(0);
      for (let i = 0; i < numDeposits; i++) {
        const deposit = await doRandomDeposit();
        deposits.push(deposit);
        blockFee = blockFee.add(deposit.fee);
      }

      // Wait a bit until the operator only gets half the block fee
      const addedTime = exchangeTestUtil.FEE_BLOCK_FINE_START_TIME + exchangeTestUtil.FEE_BLOCK_FINE_MAX_DURATION / 2;
      await exchangeTestUtil.advanceBlockTimestamp(addedTime);

      // Commit and verify the deposits
      await exchangeTestUtil.commitDeposits(exchangeId);
      await exchangeTestUtil.verifyPendingBlocks(exchangeId);

      // Withdraw the blockFee (half the complete block fee)
      const blockIdx = await exchange.getBlockHeight();
      await withdrawBlockFeeChecked(
        blockIdx, exchangeTestUtil.exchangeOperator, blockFee,
        blockFee.div(new BN(2)), blockFee.div(new BN(100)),
      );
    });

    it("Withdraw block fee (deposit block - no reward)", async () => {
      await createExchange();
      await exchangeTestUtil.commitDeposits(exchangeId);
      await exchangeTestUtil.verifyPendingBlocks(exchangeId);

      // Do some deposits
      const numDeposits = exchangeTestUtil.depositBlockSizes[0];
      let blockFee = new BN(0);
      for (let i = 0; i < numDeposits; i++) {
        const deposit = await doRandomDeposit();
        blockFee = blockFee.add(deposit.fee);
      }

      // Wait a bit until the operator only gets half the block fee
      const addedTime = exchangeTestUtil.FEE_BLOCK_FINE_START_TIME +
                        exchangeTestUtil.FEE_BLOCK_FINE_MAX_DURATION + 1000;
      await exchangeTestUtil.advanceBlockTimestamp(addedTime);

      // Commit and verify the deposits
      await exchangeTestUtil.commitDeposits(exchangeId);
      await exchangeTestUtil.verifyPendingBlocks(exchangeId);

      // Withdraw the blockFee (everything burned)
      const blockIdx = await exchange.getBlockHeight();
      await withdrawBlockFeeChecked(
        blockIdx, exchangeTestUtil.exchangeOperator, blockFee,
        new BN(0),
      );
    });

    it("Withdraw block fee (withdrawal block - fined)", async () => {
      await createExchange();
      await exchangeTestUtil.commitDeposits(exchangeId);
      await exchangeTestUtil.verifyPendingBlocks(exchangeId);

      // Do some withdrawals
      const numWithdrawals = exchangeTestUtil.onchainWithdrawalBlockSizes[0];
      let blockFee = new BN(0);
      for (let i = 0; i < numWithdrawals; i++) {
        const deposit = await doRandomDeposit();
        const withdrawal = await doRandomOnchainWithdrawal(deposit);
        blockFee = blockFee.add(withdrawal.withdrawalFee);
      }

      // Wait a bit until the operator only gets half the block fee
      const addedTime = exchangeTestUtil.FEE_BLOCK_FINE_START_TIME + exchangeTestUtil.FEE_BLOCK_FINE_MAX_DURATION / 2;
      await exchangeTestUtil.advanceBlockTimestamp(addedTime);

      // Commit and verify the deposits
      await exchangeTestUtil.commitDeposits(exchangeId);
      await exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeId);
      await exchangeTestUtil.verifyPendingBlocks(exchangeId);

      // Withdraw the blockFee (half the complete block fee)
      const blockIdx = await exchange.getBlockHeight();
      await withdrawBlockFeeChecked(
        blockIdx, exchangeTestUtil.exchangeOperator, blockFee,
        blockFee.div(new BN(2)), blockFee.div(new BN(100)),
      );
    });

    it("should not be able to withdraw a block fee of a block type without a block fee", async () => {
      await createExchange();
      await exchangeTestUtil.commitDeposits(exchangeId);
      await exchangeTestUtil.verifyPendingBlocks(exchangeId);

      // Do some withdrawals
      const numWithdrawals = exchangeTestUtil.onchainWithdrawalBlockSizes[0];
      for (let i = 0; i < numWithdrawals; i++) {
        const deposit = await doRandomDeposit();
        await doRandomOffchainWithdrawal(deposit);
      }

      // Wait a bit until the operator only gets half the block fee
      const addedTime = exchangeTestUtil.FEE_BLOCK_FINE_START_TIME + exchangeTestUtil.FEE_BLOCK_FINE_MAX_DURATION / 2;
      await exchangeTestUtil.advanceBlockTimestamp(addedTime);

      // Commit and verify the deposits
      await exchangeTestUtil.commitDeposits(exchangeId);
      await exchangeTestUtil.commitOffchainWithdrawalRequests(exchangeId);
      await exchangeTestUtil.verifyPendingBlocks(exchangeId);

      // Try to withdraw a block fee from a  block type doesn't have any
      const blockIdx = await exchange.getBlockHeight();
      await expectThrow(
        exchange.withdrawBlockFee(blockIdx, {from: exchangeTestUtil.exchangeOperator}),
        "BLOCK_HAS_NO_OPERATOR_FEE",
      );
    });
  });
});
