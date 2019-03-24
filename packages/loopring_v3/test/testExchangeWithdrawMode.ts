import BN = require("bn.js");
import { Artifacts } from "../util/Artifacts";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { OrderInfo, RingInfo } from "./types";

contract("Exchange", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  const withdrawFromMerkleTreeChecked = async (realmID: number, accountID: number, token: string,
                                               owner: string, expectedAmount: BN) => {
    const balanceBefore = await exchangeTestUtil.getOnchainBalance(owner, token);
    await exchangeTestUtil.withdrawFromMerkleTree(realmID, accountID, token);
    const balanceAfter = await exchangeTestUtil.getOnchainBalance(owner, token);
    assert(balanceAfter.eq(balanceBefore.add(expectedAmount)), "Balance withdrawn in withdraw mode incorrect");
  };

  const withdrawFromPendingDepositChecked = async (realmID: number, depositBlockIdx: number, slotIdx: number,
                                                   owner: string, token: string, expectedAmount: BN) => {
    const balanceBefore = await exchangeTestUtil.getOnchainBalance(owner, token);
    await exchangeTestUtil.withdrawFromPendingDeposit(realmID, depositBlockIdx, slotIdx);
    const balanceAfter = await exchangeTestUtil.getOnchainBalance(owner, token);
    assert(balanceAfter.eq(balanceBefore.add(expectedAmount)), "Balance withdrawn in withdraw mode incorrect");
  };

  describe("Withdraw Mode", function() {
    this.timeout(0);

    it("ERC20: withdraw from merkle tree", async () => {
      const realmID = await exchangeTestUtil.createExchange(exchangeTestUtil.testContext.stateOwners[0]);
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const wallet = exchangeTestUtil.wallets[realmID][0];
      const balance = new BN(web3.utils.toWei("7.1", "ether"));
      const token = "LRC";

      const depositInfo = await exchangeTestUtil.deposit(realmID, owner,
                                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                         wallet.walletID, token, balance);
      const accountID = depositInfo.accountID;

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.verifyPendingBlocks(realmID);

      await expectThrow(
        exchangeTestUtil.withdrawFromMerkleTree(realmID, accountID, token),
        "NOT_IN_WITHDRAW_MODE",
      );

      // Request withdrawal onchain
      await exchangeTestUtil.requestWithdrawalOnchain(realmID, accountID, token, balance, owner);

      // Operator doesn't do anything for a long time
      await exchangeTestUtil.advanceBlockTimestamp(exchangeTestUtil.MAX_TIME_BLOCK_UNTIL_WITHDRAWALMODE + 1);

      // We should be in withdrawal mode and able to withdraw directly from the merkle tree
      await withdrawFromMerkleTreeChecked(realmID, accountID, token,
                                          owner, balance);

      // Try to withdraw again
      await expectThrow(
        exchangeTestUtil.withdrawFromMerkleTree(realmID, accountID, token),
        "WITHDRAWN_ALREADY",
      );
    });

    it("ETH: withdraw from merkle tree", async () => {
      const realmID = await exchangeTestUtil.createExchange(exchangeTestUtil.testContext.stateOwners[0]);
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const wallet = exchangeTestUtil.wallets[realmID][0];
      const balance = new BN(web3.utils.toWei("1.7", "ether"));
      const token = "ETH";

      const depositInfo = await exchangeTestUtil.deposit(realmID, owner,
                                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                         wallet.walletID, token, balance);
      const accountID = depositInfo.accountID;

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.verifyPendingBlocks(realmID);

      await expectThrow(
        exchangeTestUtil.withdrawFromMerkleTree(realmID, accountID, token),
        "NOT_IN_WITHDRAW_MODE",
      );

      // Request withdrawal onchain
      await exchangeTestUtil.requestWithdrawalOnchain(realmID, accountID, token, balance, owner);

      // Operator doesn't do anything for a long time
      await exchangeTestUtil.advanceBlockTimestamp(exchangeTestUtil.MAX_TIME_BLOCK_UNTIL_WITHDRAWALMODE + 1);

      // We should be in withdrawal mode and able to withdraw directly from the merkle tree
      await withdrawFromMerkleTreeChecked(realmID, accountID, token,
                                          owner, balance);

      // Try to withdraw again
      await expectThrow(
        exchangeTestUtil.withdrawFromMerkleTree(realmID, accountID, token),
        "WITHDRAWN_ALREADY",
      );
    });

    it("Withdraw from deposit block", async () => {
      const realmID = await exchangeTestUtil.createExchange(exchangeTestUtil.testContext.stateOwners[0]);
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const wallet = exchangeTestUtil.wallets[realmID][0];

      const tokenA = "LRC";
      const balanceA = new BN(web3.utils.toWei("2300.7", "ether"));
      const tokenB = "ETH";
      const balanceB = new BN(web3.utils.toWei("2.8", "ether"));
      const tokenC = "ETH";
      const balanceC = new BN(web3.utils.toWei("1.7", "ether"));
      const tokenD = "WETH";
      const balanceD = new BN(web3.utils.toWei("23.7", "ether"));

      const depositInfoA = await exchangeTestUtil.deposit(realmID, owner,
                                                          keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                          wallet.walletID, tokenA, balanceA);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.verifyPendingBlocks(realmID);

      const finalizedBlockIdx = (await exchangeTestUtil.exchange.getBlockIdx(web3.utils.toBN(realmID))).toNumber();

      const depositInfoB = await exchangeTestUtil.deposit(realmID, owner,
                                                          keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                          wallet.walletID, tokenB, balanceB);

      await exchangeTestUtil.commitDeposits(realmID);

      const depositInfoC = await exchangeTestUtil.deposit(realmID, owner,
                                                          keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                          wallet.walletID, tokenC, balanceC);

      await exchangeTestUtil.commitDeposits(realmID);

      const depositInfoD = await exchangeTestUtil.deposit(realmID, owner,
                                                          keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                          wallet.walletID, tokenD, balanceD);

      await expectThrow(
        exchangeTestUtil.withdrawFromPendingDeposit(realmID, depositInfoA.depositBlockIdx, depositInfoA.slotIdx),
        "NOT_IN_WITHDRAW_MODE",
      );

      // Operator doesn't do anything for a long time
      await exchangeTestUtil.advanceBlockTimestamp(exchangeTestUtil.MAX_TIME_BLOCK_UNTIL_WITHDRAWALMODE + 1);

      // Try to withdraw a deposit on a non-finalized block
      await expectThrow(
        exchangeTestUtil.withdrawFromPendingDeposit(realmID, depositInfoC.depositBlockIdx, depositInfoC.slotIdx),
        "PREV_BLOCK_NOT_FINALIZED",
      );

      // Cannot revert to a non-finalized block
      await expectThrow(
        exchangeTestUtil.revertBlock(realmID, finalizedBlockIdx + 2),
        "PREV_BLOCK_NOT_FINALIZED",
      );

      // Revert back to finalized state
      await exchangeTestUtil.revertBlock(realmID, finalizedBlockIdx + 1);

      const blockIdxAfterRevert = (await exchangeTestUtil.exchange.getBlockIdx(web3.utils.toBN(realmID))).toNumber();
      assert(blockIdxAfterRevert === finalizedBlockIdx, "Should have reverted to finalized block");

      // Cannot withdraw from deposit blocks that are included in a block
      await expectThrow(
        exchangeTestUtil.withdrawFromPendingDeposit(realmID, depositInfoA.depositBlockIdx, depositInfoA.slotIdx),
        "BLOCK_COMMITTED_ALREADY",
      );
      // We should be in withdrawal mode and able to withdraw from the pending deposits
      await withdrawFromPendingDepositChecked(realmID, depositInfoB.depositBlockIdx, depositInfoB.slotIdx,
                                              owner, tokenB, balanceB);
      await withdrawFromPendingDepositChecked(realmID, depositInfoC.depositBlockIdx, depositInfoC.slotIdx,
                                              owner, tokenC, balanceC);
      await withdrawFromPendingDepositChecked(realmID, depositInfoD.depositBlockIdx, depositInfoD.slotIdx,
                                              owner, tokenD, balanceD);

      // Try to withdraw again
      await expectThrow(
        exchangeTestUtil.withdrawFromPendingDeposit(realmID, depositInfoC.depositBlockIdx, depositInfoC.slotIdx),
        "WITHDRAWN_ALREADY",
      );
    });

  });
});
