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

  const owner1 = accounts[0];
  const owner2 = accounts[1];
  const owner3 = accounts[2];

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

  describe("UserStakingPool", () => {
    describe("all readonly functions in default state", () => {
      it("should return correct values", async () => {
        const totalStaking = await userStakingPool.getTotalStaking();
        assert(totalStaking.eq(ZERO), "getTotalStaking");

        const {
          0: withdrawalWaitTime,
          1: rewardWaitTime,
          2: balance,
          3: claimableReward
        } = await userStakingPool.getUserStaking(owner1);

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
      it("can stake LRC and withdraw them all at once without any reward", async () => {
        const amount = new BN("1000" + "000000000000000000", 10);

        // - Action: owner2 stakes 1000 LRC
        {
          const tx = await userStakingPool.stake(amount, { from: owner2 });

          // - Check: LRCStaked emitted
          truffleAssert.eventEmitted(tx, "LRCStaked", (evt: any) => {
            return owner2 === evt.user && amount.eq(evt.amount);
          });

          // - Check: stats
          const {
            0: withdrawalWaitTime,
            1: rewardWaitTime,
            2: balance,
            3: claimableReward
          } = await userStakingPool.getUserStaking(owner2);

          assert(
            withdrawalWaitTime.eq(new BN(MIN_WITHDRAW_DELAY)),
            "withdrawalWaitTime"
          );
          assert(rewardWaitTime.eq(new BN(MIN_CLAIM_DELAY)), "rewardWaitTime");
          assert(balance.eq(amount), "balance");
          assert(claimableReward.eq(ZERO), "claimableReward");
        }

        // - Action: Fast forward time by MIN_WITHDRAW_DELAY/2
        {
          await advanceTimeAndBlockAsync(MIN_WITHDRAW_DELAY / 2);

          // - Check: stats
          const {
            0: withdrawalWaitTime,
            1: rewardWaitTime,
            2: balance,
            3: claimableReward
          } = await userStakingPool.getUserStaking(owner2);

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
        }

        // - Action: Advance time again to just 1 second before the user can withdrawal,
        {
          await advanceTimeAndBlockAsync(MIN_WITHDRAW_DELAY / 2 - 1);

          // - Check: stats
          const {
            0: withdrawalWaitTime,
            1: rewardWaitTime,
            2: balance,
            3: claimableReward
          } = await userStakingPool.getUserStaking(owner2);

          assert(withdrawalWaitTime.eq(new BN(1)), "withdrawalWaitTime");
          assert(rewardWaitTime.eq(new BN(1)), "rewardWaitTime");
          assert(balance.eq(amount), "balance");
          assert(claimableReward.eq(ZERO), "claimableReward");

          // - Check: withdrawal will fail
          await truffleAssert.fails(
            userStakingPool.withdraw(ZERO, { from: owner2 }),
            truffleAssert.ErrorType.REVERT
          );
        }

        // - Action: Advance time again by 1 second so user can withdraw
        {
          await advanceTimeAndBlockAsync(1);

          // - Check: stats
          const {
            0: withdrawalWaitTime,
            1: rewardWaitTime,
            2: balance,
            3: claimableReward
          } = await userStakingPool.getUserStaking(owner2);

          assert(withdrawalWaitTime.eq(ZERO), "withdrawalWaitTime");
          assert(rewardWaitTime.eq(ZERO), "rewardWaitTime");
          assert(balance.eq(amount), "balance");
          assert(claimableReward.eq(ZERO), "claimableReward");
        }

        // - Action: Advance time again by 1 more second so user can still withdraw
        {
          await advanceTimeAndBlockAsync(1);

          // - Check: stats
          const {
            0: withdrawalWaitTime,
            1: rewardWaitTime,
            2: balance,
            3: claimableReward
          } = await userStakingPool.getUserStaking(owner2);

          assert(withdrawalWaitTime.eq(ZERO), "withdrawalWaitTime");
          assert(rewardWaitTime.eq(ZERO), "rewardWaitTime");
          assert(balance.eq(amount), "balance");
          assert(claimableReward.eq(ZERO), "claimableReward");
        }

        // - Action: Withdraw all LRC
        {
          const tx = await userStakingPool.withdraw(ZERO, { from: owner2 });

          // - Check: LRCWithdrawn event emitted
          truffleAssert.eventEmitted(tx, "LRCWithdrawn", (evt: any) => {
            return owner2 === evt.user && amount.eq(evt.amount);
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
          } = await userStakingPool.getUserStaking(owner2);

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
});
