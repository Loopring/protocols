import { Artifacts } from "../util/Artifacts";
import { advanceTimeAndBlockAsync } from "../util/TimeTravel";
import { expectThrow } from "./expectThrow";
import BN = require("bn.js");
const truffleAssert = require("truffle-assertions");

contract("UserStakingPool", (accounts: string[]) => {
  const contracts = new Artifacts(artifacts);
  const MockContract = contracts.MockContract;
  const UserStakingPool = contracts.UserStakingPool;

  const ZERO = new BN(0);

  var mockLRC: any;
  var mockProtocolFeeVault: any;
  var userStakingPool: any;

  var MIN_WITHDRAW_DELAY: number;
  var MIN_CLAIM_DELAY: number;

  before(async () => {
    mockLRC = await MockContract.new();
    mockProtocolFeeVault = await MockContract.new();
    userStakingPool = await UserStakingPool.new(mockLRC.address);

    MIN_WITHDRAW_DELAY = (await userStakingPool.MIN_WITHDRAW_DELAY()).toNumber();
    MIN_CLAIM_DELAY = (await userStakingPool.MIN_CLAIM_DELAY()).toNumber();

    assert.equal(MIN_WITHDRAW_DELAY, MIN_CLAIM_DELAY, "test assumption failed");
  });

  beforeEach(async () => {
    await mockLRC.reset();
    await mockProtocolFeeVault.reset();
  });

  describe("When nobody staked anything, user Alice", () => {
    const alice = accounts[1];

    it("can query getTotalStaking and get default result", async () => {
      const totalStaking = await userStakingPool.getTotalStaking();
      assert(totalStaking.eq(ZERO), "getTotalStaking");
    });

    it("can query getUserStaking and get default result", async () => {
      const {
        0: withdrawalWaitTime,
        1: rewardWaitTime,
        2: balance,
        3: claimableReward
      } = await userStakingPool.getUserStaking(alice);

      assert(
        withdrawalWaitTime.eq(new BN(MIN_WITHDRAW_DELAY)),
        "withdrawalWaitTime"
      );
      assert(rewardWaitTime.eq(new BN(MIN_CLAIM_DELAY)), "rewardWaitTime");
      assert(balance.eq(ZERO), "balance");
      assert(claimableReward.eq(ZERO), "claimableReward");
    });
  });

  describe("When no protocol fee vault is set, a user Bob can", () => {
    const bob = accounts[2];
    const amount = new BN("1000" + "000000000000000000", 10);

    it("can stake 1000 LRC then query getUserStaking", async () => {
      const tx = await userStakingPool.stake(amount, { from: bob });

      // - Check: LRCStaked emitted
      truffleAssert.eventEmitted(tx, "LRCStaked", (evt: any) => {
        return bob === evt.user && amount.eq(evt.amount);
      });

      // - Check: stats
      const {
        0: withdrawalWaitTime,
        1: rewardWaitTime,
        2: balance,
        3: claimableReward
      } = await userStakingPool.getUserStaking(bob);

      assert(
        withdrawalWaitTime.eq(new BN(MIN_WITHDRAW_DELAY)),
        "withdrawalWaitTime"
      );
      assert(rewardWaitTime.eq(new BN(MIN_CLAIM_DELAY)), "rewardWaitTime");
      assert(balance.eq(amount), "balance");
      assert(claimableReward.eq(ZERO), "claimableReward");
    });

    it("can query getUserStaking after MIN_WITHDRAW_DELAY/2 seconds", async () => {
      await advanceTimeAndBlockAsync(MIN_WITHDRAW_DELAY / 2);

      // - Check: stats
      const {
        0: withdrawalWaitTime,
        1: rewardWaitTime,
        2: balance,
        3: claimableReward
      } = await userStakingPool.getUserStaking(bob);

      assert(
        withdrawalWaitTime.eq(new BN(MIN_WITHDRAW_DELAY / 2)),
        "withdrawalWaitTime"
      );
      assert(
        rewardWaitTime.eq(new BN(MIN_CLAIM_DELAY - MIN_WITHDRAW_DELAY / 2)),
        "rewardWaitTime"
      );
      assert(balance.eq(amount), "balance");
      assert(claimableReward.eq(ZERO), "claimableReward");
    });

    it("can query getUserStaking 1 second before timeout but still cannot withdraw", async () => {
      await advanceTimeAndBlockAsync(MIN_WITHDRAW_DELAY / 2 - 1);

      // - Check: stats
      const {
        0: withdrawalWaitTime,
        1: rewardWaitTime,
        2: balance,
        3: claimableReward
      } = await userStakingPool.getUserStaking(bob);

      assert(withdrawalWaitTime.eq(new BN(1)), "withdrawalWaitTime");
      assert(rewardWaitTime.eq(new BN(1)), "rewardWaitTime");
      assert(balance.eq(amount), "balance");
      assert(claimableReward.eq(ZERO), "claimableReward");

      // - Check: withdrawal will fail
      await truffleAssert.fails(
        userStakingPool.withdraw(ZERO, { from: bob }),
        truffleAssert.ErrorType.REVERT
      );
    });

    it("can query getUserStaking right after timeout", async () => {
      await advanceTimeAndBlockAsync(1);

      // - Check: stats
      const {
        0: withdrawalWaitTime,
        1: rewardWaitTime,
        2: balance,
        3: claimableReward
      } = await userStakingPool.getUserStaking(bob);

      assert(withdrawalWaitTime.eq(ZERO), "withdrawalWaitTime");
      assert(rewardWaitTime.eq(ZERO), "rewardWaitTime");
      assert(balance.eq(amount), "balance");
      assert(claimableReward.eq(ZERO), "claimableReward");
    });

    it("can query getUserStaking 1 second after timeout", async () => {
      await advanceTimeAndBlockAsync(1);

      // - Check: stats
      const {
        0: withdrawalWaitTime,
        1: rewardWaitTime,
        2: balance,
        3: claimableReward
      } = await userStakingPool.getUserStaking(bob);

      assert(withdrawalWaitTime.eq(ZERO), "withdrawalWaitTime");
      assert(rewardWaitTime.eq(ZERO), "rewardWaitTime");
      assert(balance.eq(amount), "balance");
      assert(claimableReward.eq(ZERO), "claimableReward");
    });

    it("can withdraw all LRC", async () => {
      const tx = await userStakingPool.withdraw(ZERO, { from: bob });

      // - Check: LRCWithdrawn event emitted
      truffleAssert.eventEmitted(tx, "LRCWithdrawn", (evt: any) => {
        return bob === evt.user && amount.eq(evt.amount);
      });

      // - Check: LRCRewarded event NOT emitted
      truffleAssert.eventNotEmitted(tx, "LRCRewarded");

      // - Check: stats
      //  Since all LRC has been withdrawan, wait time shall be default
      const {
        0: withdrawalWaitTime,
        1: rewardWaitTime,
        2: balance,
        3: claimableReward
      } = await userStakingPool.getUserStaking(bob);

      assert(
        withdrawalWaitTime.eq(new BN(MIN_WITHDRAW_DELAY)),
        "withdrawalWaitTime"
      );
      assert(rewardWaitTime.eq(new BN(MIN_CLAIM_DELAY)), "rewardWaitTime");
      assert(balance.eq(ZERO), "balance");
      assert(claimableReward.eq(ZERO), "claimableReward");
    });
  });

  describe("when no protocol fee vault is set, a user", () => {
    it("can stake LRC and withdraw them in multiple withdrawal without any reward", async () => {
      const amount = new BN("1000" + "000000000000000000", 10);
      const user = accounts[3];

      // - Action: user stakes 1000 LRC
      {
        const tx = await userStakingPool.stake(amount, { from: user });

        // - Check: LRCStaked emitted
        truffleAssert.eventEmitted(tx, "LRCStaked", (evt: any) => {
          return user === evt.user && amount.eq(evt.amount);
        });

        // - Check: stats
        const {
          0: withdrawalWaitTime,
          1: rewardWaitTime,
          2: balance,
          3: claimableReward
        } = await userStakingPool.getUserStaking(user);

        assert(
          withdrawalWaitTime.eq(new BN(MIN_WITHDRAW_DELAY)),
          "withdrawalWaitTime"
        );
        assert(rewardWaitTime.eq(new BN(MIN_CLAIM_DELAY)), "rewardWaitTime");
        assert(balance.eq(amount), "balance");
        assert(claimableReward.eq(ZERO), "claimableReward");
      }

      // - Action: Fast forward time by MIN_WITHDRAW_DELAY so user can withdraw
      {
        await advanceTimeAndBlockAsync(MIN_WITHDRAW_DELAY);
        // - Check: stats
        const {
          0: withdrawalWaitTime,
          1: rewardWaitTime,
          2: balance,
          3: claimableReward
        } = await userStakingPool.getUserStaking(user);

        assert(withdrawalWaitTime.eq(ZERO), "withdrawalWaitTime");
        assert(rewardWaitTime.eq(ZERO), "rewardWaitTime");
        assert(balance.eq(amount), "balance");
        assert(claimableReward.eq(ZERO), "claimableReward");
      }

      // - Action: Withdraw all 1/4 LRC
      const oneForth = amount.div(new BN(4));
      const remainingAmount = amount.sub(oneForth);
      {
        const tx = await userStakingPool.withdraw(oneForth, { from: user });

        // - Check: LRCWithdrawn event emitted
        truffleAssert.eventEmitted(tx, "LRCWithdrawn", (evt: any) => {
          return user === evt.user && oneForth.eq(evt.amount);
        });

        // - Check: LRCRewarded event NOT emitted
        truffleAssert.eventNotEmitted(tx, "LRCRewarded");

        // - Check: stats
        //  Since all LRC has been withdrawan, wait time shall be default
        const {
          0: withdrawalWaitTime,
          1: rewardWaitTime,
          2: balance,
          3: claimableReward
        } = await userStakingPool.getUserStaking(user);

        assert(withdrawalWaitTime.eq(ZERO), "withdrawalWaitTime");
        assert(rewardWaitTime.eq(ZERO), "rewardWaitTime");
        assert(balance.eq(remainingAmount), "balance");
        assert(claimableReward.eq(ZERO), "claimableReward");
      }

      // - Action: withdraw all remaining
      {
        const tx = await userStakingPool.withdraw(amount, { from: user });

        // - Check: LRCWithdrawn event emitted
        truffleAssert.eventEmitted(tx, "LRCWithdrawn", (evt: any) => {
          return user === evt.user && remainingAmount.eq(evt.amount);
        });

        // - Check: LRCRewarded event NOT emitted
        truffleAssert.eventNotEmitted(tx, "LRCRewarded");

        // - Check: stats
        //  Since all LRC has been withdrawan, wait time shall be default
        const {
          0: withdrawalWaitTime,
          1: rewardWaitTime,
          2: balance,
          3: claimableReward
        } = await userStakingPool.getUserStaking(user);

        assert(
          withdrawalWaitTime.eq(new BN(MIN_WITHDRAW_DELAY)),
          "withdrawalWaitTime"
        );
        assert(rewardWaitTime.eq(new BN(MIN_CLAIM_DELAY)), "rewardWaitTime");
        assert(balance.eq(ZERO), "balance");
        assert(claimableReward.eq(ZERO), "claimableReward");
      }
    });
  });
});
