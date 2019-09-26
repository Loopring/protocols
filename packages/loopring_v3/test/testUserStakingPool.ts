import { Artifacts } from "../util/Artifacts";
import { fastForwardTime } from "../util/TimeTravel";
import { expectThrow } from "./expectThrow";
import BN = require("bn.js");
const truffleAssert = require("truffle-assertions");

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

  beforeEach(async () => {
    await mockLRC.reset();
    await mockProtocolFeeVault.reset();
  });

  describe("UserStakingPool", () => {
    describe("all readonly methods in default state", () => {
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

    describe("when no protocol fee vault is set, a user", () => {
      it("should still be able to stake and withdrawl LRC, but no LRC should be rewareded", async () => {
        const amount = new BN("10000", 10);
        var tx = await userStakingPool.stake(amount, { from: owner2 });

        truffleAssert.eventEmitted(tx, "LRCStaked", (evt: any) => {
          return owner2 === evt.user && amount.eq(evt.amount);
        });

        truffleAssert.eventNotEmitted(tx, "LRCRewarded");
        const MIN_WITHDRAW_DELAY = await userStakingPool.MIN_WITHDRAW_DELAY();

        // Cannot withdrawl before MIN_WITHDRAW_DELAY

        // Fast forward so we can withdraw 1/3 of the token
        await fastForwardTime(MIN_WITHDRAW_DELAY);

        // const withdrawnAmount = amount.div(new BN("4", 10));
        const withdrawnAmount = amount;
        tx = await userStakingPool.withdraw(withdrawnAmount, { from: owner2 });

        truffleAssert.eventEmitted(tx, "LRCWithdrawn", (evt: any) => {
          return owner2 === evt.user && amount.eq(evt.withdrawnAmount);
        });

        const outstandingAmount = amount.sub(withdrawnAmount);
      });
    });
  });
});
