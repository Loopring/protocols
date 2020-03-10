import BN = require("bn.js");
import { Constants } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { RingInfo } from "./types";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;
  let loopring: any;
  let exchangeID = 0;

  const checkWithdrawalMode = async (expectedInWithdrawalMode: boolean) => {
    const inWithdrawalMode = await exchange.isInWithdrawalMode();
    assert.equal(
      inWithdrawalMode,
      expectedInWithdrawalMode,
      "not in expected withdrawal mode state"
    );
  };

  const createExchange = async (bSetupTestState: boolean = true) => {
    exchangeID = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      bSetupTestState
    );
    exchange = exchangeTestUtil.exchange;
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    exchange = exchangeTestUtil.exchange;
    loopring = exchangeTestUtil.loopringV3;
    exchangeID = 1;
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  const withdrawFromMerkleTreeChecked = async (
    owner: string,
    token: string,
    expectedAmount: BN
  ) => {
    const recipient =
      owner === Constants.zeroAddress
        ? await loopring.protocolFeeVault()
        : owner;
    const balanceBefore = await exchangeTestUtil.getOnchainBalance(
      recipient,
      token
    );
    await exchangeTestUtil.withdrawFromMerkleTree(owner, token);
    const balanceAfter = await exchangeTestUtil.getOnchainBalance(
      recipient,
      token
    );
    // console.log("balanceBefore: " + balanceBefore.toString(10));
    // console.log("balanceAfter: " + balanceAfter.toString(10));
    // console.log("expectedAmount: " + expectedAmount.toString(10));
    assert(
      balanceAfter.eq(balanceBefore.add(expectedAmount)),
      "Balance withdrawn in withdrawal mode incorrect"
    );

    // Try to withdraw again
    await expectThrow(
      exchangeTestUtil.withdrawFromMerkleTree(owner, token),
      "WITHDRAWN_ALREADY"
    );
  };

  const withdrawFromDepositRequestChecked = async (
    requestIdx: number,
    owner: string,
    token: string,
    expectedAmount: BN
  ) => {
    const balanceBefore = await exchangeTestUtil.getOnchainBalance(
      owner,
      token
    );
    await exchangeTestUtil.withdrawFromDepositRequest(requestIdx);
    const balanceAfter = await exchangeTestUtil.getOnchainBalance(owner, token);
    assert(
      balanceAfter.eq(balanceBefore.add(expectedAmount)),
      "Balance withdrawn in withdrawal mode incorrect"
    );
  };

  describe("Withdrawal Mode", function() {
    this.timeout(0);

    it("should go into withdrawal mode when a deposit request isn't processed", async () => {
      await createExchange(false);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE * 2
      );
      // Do a deposit
      await exchangeTestUtil.doRandomDeposit();
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE - 10
      );
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(20);
      // We should be in withdrawal mode
      await checkWithdrawalMode(true);
    });

    it("should go into withdrawal mode when a withdrawal request isn't processed", async () => {
      await createExchange(true);
      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);
      // Do a deposit
      const deposit = await exchangeTestUtil.doRandomDeposit();
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Commit the deposits
      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE * 2
      );
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Do an on-chain withdrawal
      await exchangeTestUtil.doRandomOnchainWithdrawal(deposit);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE - 10
      );
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(20);
      // We should be in withdrawal mode
      await checkWithdrawalMode(true);
    });

    it("should go into withdrawal mode when a block stays unverified (and is not reverted)", async () => {
      await createExchange(false);
      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE * 2
      );
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Do a deposit
      const deposit = await exchangeTestUtil.doRandomDeposit();
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Commit the deposits
      await exchangeTestUtil.commitDeposits(exchangeID);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE - 10
      );
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(20);
      // We should be in withdrawal mode
      await checkWithdrawalMode(true);
    });

    it("should go into withdrawal mode when shutdown without reverting to initial state", async () => {
      await createExchange(false);
      // Do a deposit
      const deposit = await exchangeTestUtil.doRandomDeposit();
      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE * 2
      );
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);

      // Shut down the exchange
      await exchange.shutdown({ from: exchangeTestUtil.exchangeOwner });

      // Calculate the time the exchange can stay in shutdown
      const numAccounts = (await exchange.getNumAccounts()).toNumber();
      const timeUntilWithdrawalMode =
        exchangeTestUtil.MAX_TIME_IN_SHUTDOWN_BASE +
        exchangeTestUtil.MAX_TIME_IN_SHUTDOWN_DELTA * numAccounts;
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(
        timeUntilWithdrawalMode - 10
      );
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(20);
      // We should be in withdrawal mode
      await checkWithdrawalMode(true);
    });

    it("ERC20: withdraw from merkle tree", async () => {
      await createExchange();

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("7.1", "ether"));
      const token = exchangeTestUtil.getTokenAddress("LRC");

      const depositInfo = await exchangeTestUtil.deposit(
        exchangeID,
        owner,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        token,
        balance
      );
      const accountID = depositInfo.accountID;

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);

      await expectThrow(
        exchangeTestUtil.withdrawFromMerkleTree(owner, token),
        "NOT_IN_WITHDRAW_MODE"
      );

      // Request withdrawal onchain
      await exchangeTestUtil.requestWithdrawalOnchain(
        exchangeID,
        accountID,
        token,
        balance,
        owner
      );

      // Operator doesn't do anything for a long time
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE + 1
      );

      // Try to withdraw with an incorrect proof
      const proof = await exchangeTestUtil.createMerkleTreeInclusionProof(
        owner,
        token
      );
      proof.balance = proof.balance.mul(new BN(2));
      await expectThrow(
        exchangeTestUtil.withdrawFromMerkleTreeWithProof(proof),
        "INVALID_MERKLE_TREE_DATA"
      );

      // We should be in withdrawal mode and able to withdraw directly from the merkle tree
      await withdrawFromMerkleTreeChecked(owner, token, balance);
    });

    it("ETH: withdraw from merkle tree", async () => {
      await createExchange();

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("1.7", "ether"));
      const token = exchangeTestUtil.getTokenAddress("ETH");

      const depositInfo = await exchangeTestUtil.deposit(
        exchangeID,
        owner,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        token,
        balance
      );
      const accountID = depositInfo.accountID;

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);

      await expectThrow(
        exchangeTestUtil.withdrawFromMerkleTree(owner, token),
        "NOT_IN_WITHDRAW_MODE"
      );

      // Do another deposit with the same amount to the account and process it in a block
      await exchangeTestUtil.deposit(
        exchangeID,
        owner,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        token,
        balance
      );
      await exchangeTestUtil.commitDeposits(exchangeID);

      // Operator doesn't do anything for a long time
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE + 1
      );

      // We should be in withdrawal mode and able to withdraw directly from the merkle tree
      // (Only the first deposit was finalized, so only that amount can be withdrawn from the Merkle tree)
      await withdrawFromMerkleTreeChecked(owner, token, balance);
    });

    it("Withdraw from merkle tree (protocol fee account)", async () => {
      await createExchange();

      const protocolFees = await exchange.getProtocolFeeValues();

      // Ring with ETH and ERC20
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
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);

      // Expected protocol fees earned
      const protocolFeeA = ring.orderA.amountB
        .mul(protocolFees.takerFeeBips)
        .div(new BN(100000));
      const protocolFeeB = ring.orderB.amountB
        .mul(protocolFees.makerFeeBips)
        .div(new BN(100000));

      await expectThrow(
        exchangeTestUtil.withdrawFromMerkleTree(
          Constants.zeroAddress,
          ring.orderA.tokenB
        ),
        "NOT_IN_WITHDRAW_MODE"
      );

      // Request withdrawal onchain
      await exchangeTestUtil.requestWithdrawalOnchain(
        exchangeID,
        0,
        ring.orderA.tokenB,
        protocolFeeA.mul(new BN(2)),
        Constants.zeroAddress
      );

      // Operator doesn't do anything for a long time
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE + 1
      );

      // We should be in withdrawal mode and able to withdraw directly from the merkle tree
      await withdrawFromMerkleTreeChecked(
        Constants.zeroAddress,
        ring.orderA.tokenB,
        protocolFeeA
      );
      await withdrawFromMerkleTreeChecked(
        Constants.zeroAddress,
        ring.orderB.tokenB,
        protocolFeeB
      );
    });

    it("Withdraw from deposit block", async () => {
      await createExchange();

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];

      const tokenA = "LRC";
      const balanceA = new BN(web3.utils.toWei("2300.7", "ether"));
      const tokenB = "ETH";
      const balanceB = new BN(web3.utils.toWei("2.8", "ether"));
      const tokenC = "ETH";
      const balanceC = new BN(web3.utils.toWei("1.7", "ether"));
      const tokenD = "WETH";
      const balanceD = new BN(web3.utils.toWei("23.7", "ether"));

      const depositInfoA = await exchangeTestUtil.deposit(
        exchangeID,
        owner,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        tokenA,
        balanceA
      );

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);

      const finalizedBlockIdx =
        (await exchangeTestUtil.getNumBlocksOnchain()) - 1;

      const depositInfoB = await exchangeTestUtil.deposit(
        exchangeID,
        owner,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        tokenB,
        balanceB
      );

      await exchangeTestUtil.commitDeposits(exchangeID);

      const depositInfoC = await exchangeTestUtil.deposit(
        exchangeID,
        owner,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        tokenC,
        balanceC
      );

      await exchangeTestUtil.commitDeposits(exchangeID);

      const depositInfoD = await exchangeTestUtil.deposit(
        exchangeID,
        owner,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        tokenD,
        balanceD
      );

      await expectThrow(
        exchangeTestUtil.withdrawFromDepositRequest(depositInfoA.depositIdx),
        "NOT_IN_WITHDRAW_MODE"
      );

      // Operator doesn't do anything for a long time
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE + 1
      );

      // Cannot withdraw from deposit blocks that are included in a block
      await expectThrow(
        exchangeTestUtil.withdrawFromDepositRequest(depositInfoA.depositIdx),
        "REQUEST_INCLUDED_IN_FINALIZED_BLOCK"
      );
      // We should be in withdrawal mode and able to withdraw from the pending deposits
      await withdrawFromDepositRequestChecked(
        depositInfoB.depositIdx,
        owner,
        tokenB,
        balanceB
      );
      await withdrawFromDepositRequestChecked(
        depositInfoC.depositIdx,
        owner,
        tokenC,
        balanceC
      );
      await withdrawFromDepositRequestChecked(
        depositInfoD.depositIdx,
        owner,
        tokenD,
        balanceD
      );

      // Try to withdraw again
      await expectThrow(
        exchangeTestUtil.withdrawFromDepositRequest(depositInfoC.depositIdx),
        "WITHDRAWN_ALREADY"
      );
    });

    it("Should not be able to do any more block state changes", async () => {
      await createExchange();

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("7.1", "ether"));
      const token = exchangeTestUtil.getTokenAddress("LRC");

      const depositInfo = await exchangeTestUtil.deposit(
        exchangeID,
        owner,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        token,
        balance
      );
      const accountID = depositInfo.accountID;

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);

      // Request withdrawal onchain
      await exchangeTestUtil.requestWithdrawalOnchain(
        exchangeID,
        accountID,
        token,
        balance,
        owner
      );

      // Operator doesn't do anything for a long time
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE + 1
      );

      // Try to shutdown the exchange
      await expectThrow(
        exchange.shutdown({ from: exchangeTestUtil.exchangeOwner }),
        "INVALID_MODE"
      );

      // Try to commit a block
      await expectThrow(
        exchange.commitBlock(
          0,
          2,
          0,
          web3.utils.hexToBytes("0x0"),
          web3.utils.hexToBytes("0x"),
          { from: exchangeTestUtil.exchangeOperator }
        ),
        "INVALID_MODE"
      );

      // Try to verify a block
      await expectThrow(
        exchange.verifyBlocks([1], [0, 0, 0, 0, 0, 0, 0, 0], {
          from: exchangeTestUtil.exchangeOperator
        }),
        "INVALID_MODE"
      );

      // Try to revert a block
      await expectThrow(
        exchange.revertBlock(1, { from: exchangeTestUtil.exchangeOperator }),
        "INVALID_MODE"
      );
    });
  });
});
