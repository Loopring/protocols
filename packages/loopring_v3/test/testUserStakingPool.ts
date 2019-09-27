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
  });

  beforeEach(async () => {
    await mockLRC.reset();
    await mockProtocolFeeVault.reset();
  });

  const getTime = async () => {
    return web3.eth.getBlock("latest").then((block: any) => {
      return block.timestamp;
    });
  };

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
      it("can stake LRC and withdraw all at once without reward", async () => {
        const amount = new BN("1000" + "000000000000000000", 10);

        // - owner2 stakes 1000 LRC
        var tx = await userStakingPool.stake(amount, { from: owner2 });

        // - Make sure LRc staked
        truffleAssert.eventEmitted(tx, "LRCStaked", (evt: any) => {
          return owner2 === evt.user && amount.eq(evt.amount);
        });

        // - Check user staking stats for owner2
        {
          console.log("time: ", await getTime());
          const {
            0: withdrawalWaitTime,
            1: rewardWaitTime,
            2: balance,
            3: claimableReward
          } = await userStakingPool.getUserStaking(owner2);

          console.log(withdrawalWaitTime);
          console.log(new BN(MIN_WITHDRAW_DELAY));

          assert(
            withdrawalWaitTime.eq(new BN(MIN_WITHDRAW_DELAY)),
            "withdrawalWaitTime"
          );
          assert(rewardWaitTime.eq(new BN(MIN_CLAIM_DELAY)), "rewardWaitTime");

          console.log(balance);
          console.log(amount);

          assert(balance.eq(amount), "balance");
          assert(claimableReward.eq(ZERO), "claimableReward");
        }

        // - Fast forward time by MIN_WITHDRAW_DELAY/2

        await advanceTimeAndBlockAsync(MIN_WITHDRAW_DELAY / 2);

        // - Query and verify user states again

        {
          console.log("time: ", await getTime());
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

        // {
        //   console.log("time: ", await getTime());
        //   const {
        //     0: withdrawalWaitTime,
        //     1: rewardWaitTime,
        //     2: balance,
        //     3: claimableReward
        //   } = await userStakingPool.getUserStaking(owner2);

        //   console.log(
        //     withdrawalWaitTime,
        //     rewardWaitTime,
        //     balance,
        //     claimableReward
        //   );
        // }

        // // cannot withdrawl 1 second before the wait period
        //  tx=  await userStakingPool.withdraw(amount, { from: owner2 });
        // truffleAssert.eventEmitted(tx2, "LRCWithdrawn", (evt: any) => {
        //   console.log("evt: ", evt)
        //   return owner2 === evt.user && amount.eq(evt.amount);
        // });

        //  truffleAssert.eventNotEmitted(tx, "LRCRewarded");
      });
    });
  });
});
