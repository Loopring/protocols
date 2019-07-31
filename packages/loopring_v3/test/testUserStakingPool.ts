import { expectThrow } from "./expectThrow";
import BN = require("bn.js");
import { ExchangeTestUtil } from "./testExchangeUtil";

contract("UserStakingPool", (accounts: string[]) => {
  const owner1 = accounts[0];
  const owner2 = accounts[1];
  const owner3 = accounts[2];
  const emptyAddr = "0x0000000000000000000000000000000000000000";

  let userstaking: any;
  let protocolfee: any;
  let exchangeTestUtil: ExchangeTestUtil;

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    userstaking = exchangeTestUtil.userstakingpool;
    protocolfee = exchangeTestUtil.protocolfeevault;
    userstaking.setProtocolFeeVault(protocolfee.address);
  });

  describe("stakeA", () => {
    it("should not stake if dont have any LRC", async () => {
      await expectThrow(
        userstaking.stake(500, { from: owner1 }),
        "TRANSFER_FAILURE"
      );
    });
    it("should not withdraw if haven't staked", async () => {
      await expectThrow(
        userstaking.withdraw(500, { from: owner1 }),
        "INSUFFICIENT_FUND"
      );
    });
    it("set User A balance as 1000", async () => {
      //const amount = new BN(web3.utils.toWei("1000", "ether"));
      const amount = new BN(1000);
      await exchangeTestUtil.setBalanceAndApprove(
        owner1,
        "LRC",
        amount,
        userstaking.address
      );
    });
    it("should get user staking equal to staked", async () => {
      await userstaking.stake(1000, { from: owner1 });
      const userstaked = await userstaking.getUserStaking(owner1);
      assert.equal(
        userstaked.stakeAmount,
        1000,
        "User staking should equal to expected"
      );
    });
    it("should get total staking equal to staked", async () => {
      const userstaked = await userstaking.getTotalStaking();
      assert.equal(userstaked, 1000, "Total staking should equal to expected");
    });
    it("should NEED_TO_WAIT when withdraw", async () => {
      await expectThrow(
        userstaking.withdraw(500, { from: owner1 }),
        "NEED_TO_WAIT"
      );
    });
    it("advance block timestampe after MIN_WITHDRAW_DELAY", async () => {
      await exchangeTestUtil.advanceBlockTimestamp(90 * 24 * 60 * 60);
    });
    it("set protocolfee as 100", async () => {
      const amount = new BN(100);
      await exchangeTestUtil.transferBalance(
        protocolfee.address,
        "LRC",
        amount
      );
    });
    it("should get claimed equal as expected", async () => {
      const userclaimed = await userstaking.claim({ from: owner1 });
      const eventArr: any = await exchangeTestUtil.getEventsFromContract(
        userstaking,
        "LRCRewarded",
        web3.eth.blockNumber
      );
      const items = eventArr.map((eventObj: any) => {
        const reward = eventObj.args.amount;
        // 70% as staking reward
        assert.equal(reward, 70, "User claimed should equal to expected");
      });
    });
    it("should get withdrawed equal as expected", async () => {
      await userstaking.withdraw(0, { from: owner1 });
      const eventArr: any = await exchangeTestUtil.getEventsFromContract(
        userstaking,
        "LRCWithdrawn",
        web3.eth.blockNumber
      );
      const items = eventArr.map((eventObj: any) => {
        const withdraw = eventObj.args.amount;
        assert.equal(withdraw, 1070, "User withdraw should equal to expected");
      });
    });
  });

  describe("stakeA&B&C", () => {
    it("set User A balance as 500", async () => {
      //const amount = new BN(web3.utils.toWei("1000", "ether"));
      const amount = new BN(500);
      await exchangeTestUtil.setBalanceAndApprove(
        owner1,
        "LRC",
        amount,
        userstaking.address
      );
    });
    it("set User B balance as 250", async () => {
      const amount = new BN(250);
      await exchangeTestUtil.setBalanceAndApprove(
        owner2,
        "LRC",
        amount,
        userstaking.address
      );
    });
    it("set User C balance as 250", async () => {
      const amount = new BN(250);
      await exchangeTestUtil.setBalanceAndApprove(
        owner3,
        "LRC",
        amount,
        userstaking.address
      );
    });
    it("should get user A staking equal to staked", async () => {
      await userstaking.stake(500, { from: owner1 });
      const userstaked = await userstaking.getUserStaking(owner1);
      assert.equal(
        userstaked.stakeAmount,
        500,
        "User staking should equal to expected"
      );
    });
    it("should get user B staking equal to staked", async () => {
      await userstaking.stake(250, { from: owner2 });
      const userstaked = await userstaking.getUserStaking(owner2);
      assert.equal(
        userstaked.stakeAmount,
        250,
        "User staking should equal to expected"
      );
    });
    it("should get user C staking equal to staked", async () => {
      await userstaking.stake(250, { from: owner3 });
      const userstaked = await userstaking.getUserStaking(owner3);
      assert.equal(
        userstaked.stakeAmount,
        250,
        "User staking should equal to expected"
      );
    });
    it("advance block timestampe after MIN_WITHDRAW_DELAY", async () => {
      await exchangeTestUtil.advanceBlockTimestamp(90 * 24 * 60 * 60);
    });
    it("set protocolfee as 200", async () => {
      const amount = new BN(200);
      await exchangeTestUtil.transferBalance(
        protocolfee.address,
        "LRC",
        amount
      );
    });
    it("should get user A claimed equal as expected", async () => {
      const userclaimed = await userstaking.claim({ from: owner1 });
      const eventArr: any = await exchangeTestUtil.getEventsFromContract(
        userstaking,
        "LRCRewarded",
        web3.eth.blockNumber
      );
      const items = eventArr.map((eventObj: any) => {
        const reward = eventObj.args.amount;
        // 200 * 70%  * (500 / (500 + 250 + 250) as staking reward
        assert.equal(reward, 70, "User claimed should equal to expected");
      });
    });
    it("should get user B claimed equal as expected", async () => {
      const userclaimed = await userstaking.claim({ from: owner2 });
      const eventArr: any = await exchangeTestUtil.getEventsFromContract(
        userstaking,
        "LRCRewarded",
        web3.eth.blockNumber
      );
      const items = eventArr.map((eventObj: any) => {
        const reward = eventObj.args.amount;
        // 200 * 70%  * (250 / (500 + 250 + 250) as staking reward
        assert.equal(reward, 35, "User claimed should equal to expected");
      });
    });
    it("should get user C claimed equal as expected", async () => {
      const userclaimed = await userstaking.claim({ from: owner3 });
      const eventArr: any = await exchangeTestUtil.getEventsFromContract(
        userstaking,
        "LRCRewarded",
        web3.eth.blockNumber
      );
      const items = eventArr.map((eventObj: any) => {
        const reward = eventObj.args.amount;
        // 200 * 70%  * (250 / (500 + 250 + 250) as staking reward
        assert.equal(reward, 35, "User claimed should equal to expected");
      });
    });
  });
});
