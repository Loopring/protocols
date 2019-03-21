import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { Block, RingInfo } from "./types";

contract("Exchange", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  const revertBlockChecked = async (stateID: number, block: Block) => {
    const LRC = await exchangeTestUtil.getTokenContract("LRC");

    const blockIdxBefore = (await exchangeTestUtil.exchange.getBlockIdx(web3.utils.toBN(stateID))).toNumber();
    const lrcBalanceBefore = await exchangeTestUtil.getOnchainBalance(exchangeTestUtil.exchange.address, "LRC");
    const lrcSupplyBefore = await LRC.totalSupply();
    const operatorRegisteredBefore =
      await exchangeTestUtil.exchange.isOperatorRegistered(stateID, block.operator.operatorID);
    const activeOperatorsBefore = await exchangeTestUtil.getActiveOperators(stateID);

    await exchangeTestUtil.revertBlock(stateID, block.blockIdx);

    const blockIdxAfter = (await exchangeTestUtil.exchange.getBlockIdx(web3.utils.toBN(stateID))).toNumber();
    const lrcBalanceAfter = await exchangeTestUtil.getOnchainBalance(exchangeTestUtil.exchange.address, "LRC");
    const lrcSupplyAfter = await LRC.totalSupply();
    const operatorRegisteredAfter =
      await exchangeTestUtil.exchange.isOperatorRegistered(stateID, block.operator.operatorID);
    const activeOperatorsAfter = await exchangeTestUtil.getActiveOperators(stateID);

    assert(blockIdxBefore > blockIdxAfter, "blockIdx should have decreased");
    assert.equal(blockIdxAfter, block.blockIdx - 1, "State should have been reverted to the specified block");

    assert(lrcBalanceBefore.eq(lrcBalanceAfter.add(exchangeTestUtil.STAKE_AMOUNT_IN_LRC)),
           "LRC balance of exchange needs to be reduced by STAKE_AMOUNT_IN_LRC");
    assert(lrcSupplyBefore.eq(lrcSupplyAfter.add(exchangeTestUtil.STAKE_AMOUNT_IN_LRC)),
           "LRC supply needs to be reduced by STAKE_AMOUNT_IN_LRC");

    assert(operatorRegisteredBefore, "Operator of block should have still been registered");
    assert(!operatorRegisteredAfter, "Operator of block should have been unregistered");
    assert.equal(activeOperatorsBefore.length, activeOperatorsAfter.length + 1,
                 "numActiveOperators should be decreased to 1");
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  describe("Revert", function() {
    this.timeout(0);

    it("Revert block", async () => {
      const stateID = await exchangeTestUtil.createNewState(exchangeTestUtil.testContext.stateOwners[0], 2);
      const ring: RingInfo = {
        orderA:
          {
            stateID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            amountF: new BN(web3.utils.toWei("1", "ether")),
          },
        orderB:
          {
            stateID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("5", "ether")),
            amountB: new BN(web3.utils.toWei("45", "ether")),
            amountF: new BN(web3.utils.toWei("3", "ether")),
          },
      };
      await exchangeTestUtil.setupRing(ring);
      const blocksVerified = await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.verifyPendingBlocks(stateID);

      // Try to revert proven blocks
      for (const block of blocksVerified) {
        await expectThrow(
          exchangeTestUtil.revertBlock(stateID, block.blockIdx),
          "INVALID_BLOCKSTATE",
        );
      }

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const wallet = exchangeTestUtil.wallets[stateID][0];
      const token = "LRC";
      const balance = new BN(web3.utils.toWei("7.1", "ether"));

      const depositInfo = await exchangeTestUtil.deposit(stateID, owner,
                                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                         wallet.walletID, token, balance);
      const pendingDeposits = exchangeTestUtil.getPendingDeposits(stateID);

      const blocksA = await exchangeTestUtil.commitDeposits(stateID, pendingDeposits);
      assert(blocksA.length === 1);

      // Try to notify too early
      await expectThrow(
        exchangeTestUtil.revertBlock(stateID, blocksA[0].blockIdx),
        "PROOF_NOT_TOO_LATE",
      );

      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(exchangeTestUtil.MAX_PROOF_GENERATION_TIME_IN_SECONDS + 1);

      // Revert the block again, now correctly
      await revertBlockChecked(stateID, blocksA[0]);

      // Submit some other work now first
      await exchangeTestUtil.sendRing(stateID, ring);
      await exchangeTestUtil.commitRings(stateID);

      // Now commit the deposits again
      const blockIndicesB = await exchangeTestUtil.commitDeposits(stateID, pendingDeposits);
      assert(blockIndicesB.length === 1);

      // Verify all blocks
      await exchangeTestUtil.verifyPendingBlocks(stateID);
    });

  });
});
