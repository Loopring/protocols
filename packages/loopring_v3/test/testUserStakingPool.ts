import { Artifacts } from "../util/Artifacts";
import { expectThrow } from "./expectThrow";
import BN = require("bn.js");

contract("UserStakingPool", (accounts: string[]) => {
  const contracts = new Artifacts(artifacts);
  const MockContract = contracts.MockContract;
  const UserStakingPool = contracts.UserStakingPool;

  const MAX_TIME = new BN("ffffffffffffffff", 16);
  const ZERO = new BN("0", 10);

  const owner1 = accounts[0];
  const owner2 = accounts[1];
  const owner3 = accounts[2];

  var mockLRC: any;
  var mockProtocolFeeVault: any;
  var userStakingPool: any;

  before(async () => {
    mockLRC = await MockContract.new();
    mockProtocolFeeVault = await MockContract.new();
    userStakingPool = await UserStakingPool.new(mockLRC.address);
  });

  describe("all methods in default state", async () => {
    it("should behave as sepected", async () => {
      const totalStaking = await userStakingPool.getTotalStaking();
      assert.equal(totalStaking, 0, "getTotalStaking");

      const {
        0: withdrawalWaitTime,
        1: rewardWaitTime,
        2: balance,
        3: claimableReward
      } = await userStakingPool.getUserStaking(owner1);

      assert(withdrawalWaitTime.eq(MAX_TIME), "withdrawalWaitTime");
      assert(rewardWaitTime.eq(MAX_TIME), "rewardWaitTime");
      assert(balance.eq(ZERO), "balance");
      assert(claimableReward.eq(ZERO), "claimableReward");
    });
  });

  // describe("stakeA", () => {
  //   it("should not stake if dont have any LRC", async () => {
  //     await expectThrow(
  //       userstaking.stake(500, { from: owner1 }),
  //       "TRANSFER_FAILURE"
  //     );
  //   });
  //   it("should not withdraw if haven't staked", async () => {
  //     await expectThrow(
  //       userstaking.withdraw(500, { from: owner1 }),
  //       "INSUFFICIENT_FUND"
  //     );
  //   });
  //   it("set User A balance as 1000", async () => {
  //     //const amount = new BN(web3.utils.toWei("1000", "ether"));
  //     const amount = new BN(1000);
  //     await exchangeTestUtil.setBalanceAndApprove(
  //       owner1,
  //       "LRC",
  //       amount,
  //       userstaking.address
  //     );
  //   });
  //   it("should get user staking equal to staked", async () => {
  //     await userstaking.stake(1000, { from: owner1 });
  //     const userstaked = await userstaking.getUserStaking(owner1);
  //     assert.equal(
  //       userstaked.balance,
  //       1000,
  //       "User staking should equal to expected"
  //     );
  //   });
  //   it("should get total staking equal to staked", async () => {
  //     const userstaked = await userstaking.getTotalStaking();
  //     assert.equal(userstaked, 1000, "Total staking should equal to expected");
  //   });
  //   it("should NEED_TO_WAIT when withdraw", async () => {
  //     await expectThrow(
  //       userstaking.withdraw(500, { from: owner1 }),
  //       "NEED_TO_WAIT"
  //     );
  //   });
  //   it("advance block timestampe after MIN_WITHDRAW_DELAY", async () => {
  //     await exchangeTestUtil.advanceBlockTimestamp(90 * 24 * 60 * 60);
  //   });
  //   it("set protocolfee as 100", async () => {
  //     const amount = new BN(100);
  //     await exchangeTestUtil.transferBalance(
  //       protocolfee.address,
  //       "LRC",
  //       amount
  //     );
  //   });
  //   it("should get claimed equal as expected", async () => {
  //     const userclaimed = await userstaking.claim({ from: owner1 });
  //     const eventArr: any = await exchangeTestUtil.getEventsFromContract(
  //       userstaking,
  //       "LRCRewarded",
  //       web3.eth.blockNumber
  //     );
  //     const items = eventArr.map((eventObj: any) => {
  //       const reward = eventObj.args.amount;
  //       // 70% as staking reward
  //       assert.equal(reward, 70, "User claimed should equal to expected");
  //     });
  //   });
  //   it("should get withdrawed equal as expected", async () => {
  //     await userstaking.withdraw(0, { from: owner1 });
  //     const eventArr: any = await exchangeTestUtil.getEventsFromContract(
  //       userstaking,
  //       "LRCWithdrawn",
  //       web3.eth.blockNumber
  //     );
  //     const items = eventArr.map((eventObj: any) => {
  //       const withdraw = eventObj.args.amount;
  //       assert.equal(withdraw, 1070, "User withdraw should equal to expected");
  //     });
  //   });
  // });

  // for (let i = 0; i < 2; i++) {
  //   describe("stakeA&B&C", () => {
  //     it("set User A balance as 1000", async () => {
  //       //const amount = new BN(web3.utils.toWei("1000", "ether"));
  //       const amount = new BN(1000);
  //       await exchangeTestUtil.setBalanceAndApprove(
  //         owner1,
  //         "LRC",
  //         amount,
  //         userstaking.address
  //       );
  //     });
  //     it("set User B balance as 1000", async () => {
  //       const amount = new BN(1000);
  //       await exchangeTestUtil.setBalanceAndApprove(
  //         owner2,
  //         "LRC",
  //         amount,
  //         userstaking.address
  //       );
  //     });
  //     it("set User C balance as 1000", async () => {
  //       const amount = new BN(1000);
  //       await exchangeTestUtil.setBalanceAndApprove(
  //         owner3,
  //         "LRC",
  //         amount,
  //         userstaking.address
  //       );
  //     });
  //     it("should get user A staking equal to staked", async () => {
  //       await userstaking.stake(1000, { from: owner1 });
  //       const userstaked = await userstaking.getUserStaking(owner1);
  //       assert.equal(
  //         userstaked.balance,
  //         1000,
  //         "User staking should equal to expected"
  //       );
  //     });
  //     it("advance block timestampe after 30 days", async () => {
  //       await exchangeTestUtil.advanceBlockTimestamp(30 * 24 * 60 * 60);
  //     });
  //     it("should get user B staking equal to staked", async () => {
  //       await userstaking.stake(1000, { from: owner2 });
  //       const userstaked = await userstaking.getUserStaking(owner2);
  //       assert.equal(
  //         userstaked.balance,
  //         1000,
  //         "User staking should equal to expected"
  //       );
  //     });
  //     it("advance block timestampe after 30 days", async () => {
  //       await exchangeTestUtil.advanceBlockTimestamp(30 * 24 * 60 * 60);
  //     });
  //     it("should get user C staking equal to staked", async () => {
  //       await userstaking.stake(1000, { from: owner3 });
  //       const userstaked = await userstaking.getUserStaking(owner3);
  //       assert.equal(
  //         userstaked.balance,
  //         1000,
  //         "User staking should equal to expected"
  //       );
  //     });
  //     it("advance block timestampe after MIN_WITHDRAW_DELAY: 90 days", async () => {
  //       await exchangeTestUtil.advanceBlockTimestamp(90 * 24 * 60 * 60);
  //     });
  //     it("set protocolfee as 120", async () => {
  //       const amount = new BN(120);
  //       await exchangeTestUtil.transferBalance(
  //         protocolfee.address,
  //         "LRC",
  //         amount
  //       );
  //     });
  //     it("should get user A claimed equal as expected", async () => {
  //       const userclaimed = await userstaking.claim({ from: owner1 });
  //       const eventArr: any = await exchangeTestUtil.getEventsFromContract(
  //         userstaking,
  //         "LRCRewarded",
  //         web3.eth.blockNumber
  //       );
  //       const items = eventArr.map((eventObj: any) => {
  //         const reward = eventObj.args.amount;
  //         // 120 * 70%  * (180 / (180 + 120 + 90)) == 35 as staking reward
  //         // as A's staking time is 30 + 30 + 90 days, B's staking time is 30 + 90 days and C's staking time is 90 days

  //         // 34 for round down when div
  //         assert(
  //           reward == 35 || reward == 34,
  //           "User claimed should equal to expected"
  //         );
  //       });
  //     });
  //     it("should get user B claimed equal as expected", async () => {
  //       const userclaimed = await userstaking.claim({ from: owner2 });
  //       const eventArr: any = await exchangeTestUtil.getEventsFromContract(
  //         userstaking,
  //         "LRCRewarded",
  //         web3.eth.blockNumber
  //       );
  //       const items = eventArr.map((eventObj: any) => {
  //         const reward = eventObj.args.amount;
  //         // 120 * 70%  * (180 / (180 + 120 + 90)) == 28 as staking reward
  //         assert(
  //           reward == 27 || reward == 28 || reward == 29,
  //           "User claimed should equal to expected"
  //         );
  //       });
  //     });
  //     it("should get user C claimed equal as expected", async () => {
  //       const userclaimed = await userstaking.claim({ from: owner3 });
  //       const eventArr: any = await exchangeTestUtil.getEventsFromContract(
  //         userstaking,
  //         "LRCRewarded",
  //         web3.eth.blockNumber
  //       );
  //       const items = eventArr.map((eventObj: any) => {
  //         const reward = eventObj.args.amount;
  //         // 120 * 70%  * (180 / (180 + 120 + 90)) == 21 as staking reward
  //         assert(
  //           reward == 20 || reward == 21 || reward == 22,
  //           "User claimed should equal to expected"
  //         );
  //       });
  //     });
  //     it("User A withdraw all", async () => {
  //       await userstaking.withdraw(0, { from: owner1 });
  //     });
  //     it("User B withdraw all", async () => {
  //       await userstaking.withdraw(0, { from: owner2 });
  //     });
  //     it("User C withdraw all", async () => {
  //       await userstaking.withdraw(0, { from: owner3 });
  //     });
  //     it("ProtocolFeeValut status should as expected", async () => {
  //       const stats = await protocolfee.getProtocolFeeStats();
  //       // 30 is in statkeA test
  //       assert.equal(
  //         stats.remainingFees,
  //         30 + (i + 1) * 36,
  //         "ProtocolFeeValut remainingFees should as exptectd"
  //       );
  //       assert.equal(
  //         stats.remainingReward,
  //         0,
  //         "ProtocolFeeValut remainingReward should as exptectd"
  //       );
  //       assert.equal(
  //         stats.remainingDAOFund,
  //         20 + (i + 1) * 24,
  //         "ProtocolFeeValut remainingDAOFund should as exptectd"
  //       );
  //       assert.equal(
  //         stats.remainingBurn,
  //         10 + (i + 1) * 12,
  //         "ProtocolFeeValut remainingBurn should as exptectd"
  //       );
  //     });
  //     it("advance block timestampe after 30 days", async () => {
  //       await exchangeTestUtil.advanceBlockTimestamp(30 * 24 * 60 * 60);
  //     });
  //   });
  // }
});
