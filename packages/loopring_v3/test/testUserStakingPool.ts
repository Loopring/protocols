import { Artifacts } from "../util/Artifacts";
import { advanceTimeAndBlockAsync } from "../util/TimeTravel";
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

        const time1 = await getTime();

        {
          console.log("time: ", await getTime());
          const {
            0: withdrawalWaitTime,
            1: rewardWaitTime,
            2: balance,
            3: claimableReward
          } = await userStakingPool.getUserStaking(owner2);

          console.log(
            withdrawalWaitTime,
            rewardWaitTime,
            balance,
            claimableReward
          );
        }

        const MIN_WITHDRAW_DELAY = (await userStakingPool.MIN_WITHDRAW_DELAY()).toNumber();

        console.log("time: ", await getTime());
        console.log("MIN_WITHDRAW_DELAY: ", MIN_WITHDRAW_DELAY);

        // Cannot withdrawl before MIN_WITHDRAW_DELAY
        await advanceTimeAndBlockAsync(MIN_WITHDRAW_DELAY + 1);

        {
          console.log("time: ", await getTime());
          const {
            0: withdrawalWaitTime,
            1: rewardWaitTime,
            2: balance,
            3: claimableReward
          } = await userStakingPool.getUserStaking(owner2);

          console.log(
            withdrawalWaitTime,
            rewardWaitTime,
            balance,
            claimableReward
          );
        }

        // cannot withdrawl 1 second before the wait period
        truffleAssert.fails(
          userStakingPool.withdraw(amount, { from: owner2 }),
          truffleAssert.ErrorType.REVERT,
          "NEED_TO_WAIT"
        );

        // // Fast forward to exact the time that allows withdrawal
        // // so we can withdraw 1/3 of the token
        // await fastForwardTime(1);

        // truffleAssert.fails(
        //   userStakingPool.withdraw(amount, { from: owner3 }),
        //   truffleAssert.ErrorType.REVERT,
        //   "NEED_TO_WAIT",
        //   "other account cannot withdraw"
        // );

        // const withdrawnAmount = amount.div(new BN("3", 10));
        // //         // const withdrawnAmount = amount;
        // tx = await userStakingPool.withdraw(withdrawnAmount, { from: owner2 });

        // truffleAssert.eventEmitted(tx, "LRCWithdrawn", (evt: any) => {
        //   console.log("LRCWithdrawn: ", evt.amount);
        //   return owner2 === evt.user && withdrawnAmount.eq(evt.amount);
        // });

        // const outstandingAmount = amount.sub(withdrawnAmount);
      });
    });
  });
});
