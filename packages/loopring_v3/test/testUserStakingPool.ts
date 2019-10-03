import { Artifacts } from "../util/Artifacts";
import { advanceTimeAndBlockAsync } from "../util/TimeTravel";
import { expectThrow } from "./expectThrow";
import BN = require("bn.js");
const truffleAssert = require("truffle-assertions");
const abi = require("ethereumjs-abi");

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

  const owner = accounts[0];
  const alice = accounts[1];
  const bob = accounts[2];
  const charles = accounts[3];

  describe("when protocol fee valut is NOT set", () => {
    before(async () => {
      mockLRC = await MockContract.new();
      mockProtocolFeeVault = await MockContract.new();
      userStakingPool = await UserStakingPool.new(mockLRC.address);

      MIN_WITHDRAW_DELAY = (await userStakingPool.MIN_WITHDRAW_DELAY()).toNumber();
      MIN_CLAIM_DELAY = (await userStakingPool.MIN_CLAIM_DELAY()).toNumber();

      assert.equal(
        MIN_WITHDRAW_DELAY,
        MIN_CLAIM_DELAY,
        "test assumption failed"
      );
    });

    describe("When nobody staked anything, user Alice", () => {
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

    describe("When no protocol fee vault is set, user Bob can", () => {
      const bob = accounts[2];
      const amount = new BN(web3.utils.toWei("1000", "ether"));

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

    describe("when no protocol fee vault is set, user Charles", () => {
      const amount = new BN(web3.utils.toWei("1000", "ether"));

      it("can stake 1000 LRC", async () => {
        const tx = await userStakingPool.stake(amount, { from: charles });

        // - Check: LRCStaked emitted
        truffleAssert.eventEmitted(tx, "LRCStaked", (evt: any) => {
          return charles === evt.user && amount.eq(evt.amount);
        });

        // - Check: stats
        const {
          0: withdrawalWaitTime,
          1: rewardWaitTime,
          2: balance,
          3: claimableReward
        } = await userStakingPool.getUserStaking(charles);

        assert(
          withdrawalWaitTime.eq(new BN(MIN_WITHDRAW_DELAY)),
          "withdrawalWaitTime"
        );
        assert(rewardWaitTime.eq(new BN(MIN_CLAIM_DELAY)), "rewardWaitTime");
        assert(balance.eq(amount), "balance");
        assert(claimableReward.eq(ZERO), "claimableReward");
      });

      it("then check his staking status after MIN_WITHDRAW_DELAY minutes", async () => {
        await advanceTimeAndBlockAsync(MIN_WITHDRAW_DELAY);
        // - Check: stats
        const {
          0: withdrawalWaitTime,
          1: rewardWaitTime,
          2: balance,
          3: claimableReward
        } = await userStakingPool.getUserStaking(charles);

        assert(withdrawalWaitTime.eq(ZERO), "withdrawalWaitTime");
        assert(rewardWaitTime.eq(ZERO), "rewardWaitTime");
        assert(balance.eq(amount), "balance");
        assert(claimableReward.eq(ZERO), "claimableReward");
      });

      const oneForth = amount.div(new BN(4));
      const remainingAmount = amount.sub(oneForth);

      it("then withdraw 1/4 LRC", async () => {
        // - Action: Withdraw all 1/4 LRC

        const tx = await userStakingPool.withdraw(oneForth, { from: charles });

        // - Check: LRCWithdrawn event emitted
        truffleAssert.eventEmitted(tx, "LRCWithdrawn", (evt: any) => {
          return charles === evt.user && oneForth.eq(evt.amount);
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
        } = await userStakingPool.getUserStaking(charles);

        assert(withdrawalWaitTime.eq(ZERO), "withdrawalWaitTime");
        assert(rewardWaitTime.eq(ZERO), "rewardWaitTime");
        assert(balance.eq(remainingAmount), "balance");
        assert(claimableReward.eq(ZERO), "claimableReward");
      });

      it("then withdraw all remaining LRC", async () => {
        const tx = await userStakingPool.withdraw(amount, { from: charles });

        // - Check: LRCWithdrawn event emitted
        truffleAssert.eventEmitted(tx, "LRCWithdrawn", (evt: any) => {
          return charles === evt.user && remainingAmount.eq(evt.amount);
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
        } = await userStakingPool.getUserStaking(charles);

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

  describe("when protocol fee valut IS set", () => {
    before(async () => {
      mockLRC = await MockContract.new();
      mockProtocolFeeVault = await MockContract.new();
      userStakingPool = await UserStakingPool.new(mockLRC.address, {
        from: owner
      });

      MIN_WITHDRAW_DELAY = (await userStakingPool.MIN_WITHDRAW_DELAY()).toNumber();
      MIN_CLAIM_DELAY = (await userStakingPool.MIN_CLAIM_DELAY()).toNumber();

      assert.equal(
        MIN_WITHDRAW_DELAY,
        MIN_CLAIM_DELAY,
        "test assumption failed"
      );
    });

    describe("Two users claim one after another", () => {
      const amount = new BN(web3.utils.toWei("100", "ether"));
      var totalReward = new BN(web3.utils.toWei("500", "ether"));

      it("Alice and bob stake the same amount but cannot claim before waiting period", async () => {
        await userStakingPool.setProtocolFeeVault(
          mockProtocolFeeVault.address,
          {
            from: owner
          }
        );

        await userStakingPool.stake(amount, { from: alice });
        await userStakingPool.stake(amount, { from: bob });

        await advanceTimeAndBlockAsync(MIN_CLAIM_DELAY - 1);

        // cannot claim yet
        await expectThrow(
          userStakingPool.claim({ from: alice }),
          "NEED_TO_WAIT"
        );
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
          return (
            alice === evt.user && totalReward.div(new BN(2)).eq(evt.amount)
          );
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
          return bob === evt.user && totalReward.eq(evt.amount);
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
});
