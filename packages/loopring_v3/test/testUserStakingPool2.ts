import { Artifacts } from "../util/Artifacts";
import { advanceTimeAndBlockAsync } from "../util/TimeTravel";
import { expectThrow } from "./expectThrow";
import BN = require("bn.js");
const truffleAssert = require("truffle-assertions");
const abi = require("ethereumjs-abi");

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
  const owner = accounts[0];

  before(async () => {
    mockLRC = await MockContract.new();
    mockProtocolFeeVault = await MockContract.new();
    userStakingPool = await UserStakingPool.new(mockLRC.address, {
      from: owner
    });

    MIN_WITHDRAW_DELAY = (await userStakingPool.MIN_WITHDRAW_DELAY()).toNumber();
    MIN_CLAIM_DELAY = (await userStakingPool.MIN_CLAIM_DELAY()).toNumber();

    assert.equal(MIN_WITHDRAW_DELAY, MIN_CLAIM_DELAY, "test assumption failed");
  });

  describe("Two users claim one after another", () => {
    const alice = accounts[1];
    const bob = accounts[2];

    const amount = new BN(web3.utils.toWei("100", "ether"));
    var totalReward = new BN(web3.utils.toWei("500", "ether"));

    it("Alice and bob stake the same amount but cannot claim before waiting period", async () => {
      await userStakingPool.setProtocolFeeVault(mockProtocolFeeVault.address, {
        from: owner
      });

      await userStakingPool.stake(amount, { from: alice });
      await userStakingPool.stake(amount, { from: bob });

      await advanceTimeAndBlockAsync(MIN_CLAIM_DELAY - 1);

      // cannot claim yet
      await expectThrow(userStakingPool.claim({ from: alice }), "NEED_TO_WAIT");
    });
    // mocke ProtocolFeeVault to return 500 LRC as total reward

    it("then Alice can claim 50% of the LRC reward", async () => {
      const getProtocolFeeStats = web3.utils
        .sha3("getProtocolFeeStats()")
        .slice(0, 10);

      await mockProtocolFeeVault.givenMethodReturn(
        getProtocolFeeStats,
        abi.rawEncode(
          ["uint", "uint", "uint", "uint", "uint", "uint", "uint", "uint"],
          [0, 0, 0, 0, 0, 0, 0, totalReward]
        )
      );

      await advanceTimeAndBlockAsync(1);

      const tx = await userStakingPool.claim({ from: alice });

      truffleAssert.eventEmitted(tx, "LRCRewarded", (evt: any) => {
        console.error(
          "event alice: ",
          totalReward.div(new BN(2)).toString(10),
          evt.amount.toString(10)
        );
        return alice === evt.user; // && totalReward.div(new BN(2)).eq(evt.amount);
      });

      const {
        0: withdrawalWaitTime,
        1: rewardWaitTime,
        2: balance,
        3: claimableReward
      } = await userStakingPool.getUserStaking(alice);

      assert(rewardWaitTime.eq(new BN(MIN_CLAIM_DELAY)), "rewardWaitTime");
      assert(balance.eq(amount.add(totalReward.div(new BN(2)))), "balance");
      assert(claimableReward.eq(ZERO), "claimableReward");
    });

    it("then Bob can claim 100% of the remaining LRC reward", async () => {
      // then Bob can claim all remaining reward after timeout
      const tx = await userStakingPool.claim({ from: bob });
      truffleAssert.eventEmitted(tx, "LRCRewarded", (evt: any) => {
        console.error(
          "event bob: ",
          totalReward.toString(10),
          evt.amount.toString(10)
        );
        return bob === evt.user; // && totalReward.eq(evt.amount);
      });

      const {
        0: withdrawalWaitTime,
        1: rewardWaitTime,
        2: balance,
        3: claimableReward
      } = await userStakingPool.getUserStaking(bob);

      assert(rewardWaitTime.eq(new BN(MIN_CLAIM_DELAY)), "rewardWaitTime");
      assert(balance.eq(amount.add(totalReward)), "balance");
      assert(claimableReward.eq(ZERO), "claimableReward");
    });
  });
});
