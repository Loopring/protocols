import { Artifacts } from "../util/Artifacts";
import { advanceTimeAndBlockAsync } from "../util/TimeTravel";
import { expectThrow } from "./expectThrow";
import BN = require("bn.js");
const truffleAssert = require("truffle-assertions");

contract("UserStakingPool2", (accounts: string[]) => {
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
});
