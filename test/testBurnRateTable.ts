import BN = require("bn.js");
import { expectThrow } from "protocol2-js";
import { Artifacts } from "../util/Artifacts";

const {
  BurnRateTable,
  TradeDelegate,
  DummyToken,
  LRCToken,
  WETHToken,
} = new Artifacts(artifacts);

contract("BurnRateTable", (accounts: string[]) => {
  const deployer = accounts[0];
  const mockedExchangeAddress = accounts[1];
  const user1 = accounts[2];
  const user2 = accounts[3];
  const user3 = accounts[4];
  const user4 = accounts[5];

  let burnRateTable: any;
  let tokenLRC: string;
  let tokenWETH: string;
  const token1 = "0x" + "1".repeat(40);
  const token2 = "0x" + "2".repeat(40);
  const token3 = "0x" + "3".repeat(40);
  const token4 = "0x" + "4".repeat(40);

  const DAY_TO_SECONDS = 3600 * 24;

  let LOCK_TIME: number;
  let LINEAR_UNLOCK_START_TIME: number;

  let BURN_BASE_PERCENTAGE: number;
  let LOCK_BASE_PERCENTAGE: number;

  const assertNumberEqualsWithPrecision = (n1: number, n2: number, description: string, precision: number = 8) => {
    const numStr1 = (n1 / 1e18).toFixed(precision);
    const numStr2 = (n2 / 1e18).toFixed(precision);

    return assert.equal(Number(numStr1), Number(numStr2), description);
  };

  const advanceBlockTimestamp = async (seconds: number) => {
    const previousTimestamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_increaseTime", params: [seconds], id: 0 });
    await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_mine", params: [], id: 0 });
    const currentTimestamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    assert(Math.abs(currentTimestamp - (previousTimestamp + seconds)) < 60,
           "Timestamp should have been increased by roughly the expected value");
  };

  const getTierRate = async (tier: number) => {
    if (tier === 1) {
      const matching = (await burnRateTable.BURN_MATCHING_TIER1()).toNumber();
      const P2P = (await burnRateTable.BURN_P2P_TIER1()).toNumber();
      return [matching, P2P];
    } else if (tier === 2) {
      const matching = (await burnRateTable.BURN_MATCHING_TIER2()).toNumber();
      const P2P = (await burnRateTable.BURN_P2P_TIER2()).toNumber();
      return [matching, P2P];
    } else if (tier === 3) {
      const matching = (await burnRateTable.BURN_MATCHING_TIER3()).toNumber();
      const P2P = (await burnRateTable.BURN_P2P_TIER3()).toNumber();
      return [matching, P2P];
    } else if (tier === 4) {
      const matching = (await burnRateTable.BURN_MATCHING_TIER4()).toNumber();
      const P2P = (await burnRateTable.BURN_P2P_TIER4()).toNumber();
      return [matching, P2P];
    } else {
      assert(false, "Invalid tier");
    }
  };

  const getTokenTierValue = async (tier: number) => {
    if (tier === 1) {
      return (await burnRateTable.TIER_1()).toNumber();
    } else if (tier === 2) {
      return (await burnRateTable.TIER_2()).toNumber();
    } else if (tier === 3) {
      return (await burnRateTable.TIER_3()).toNumber();
    } else if (tier === 4) {
      return (await burnRateTable.TIER_4()).toNumber();
    } else {
      assert(false, "Invalid tier");
    }
  };

  const getTokenRate = async (user: string, token: string) => {
    const [burnRateMatching, rebateRateMatching] = await burnRateTable.getBurnAndRebateRate(user, token, false);
    const [burnRateP2P, rebateRateP2P] = await burnRateTable.getBurnAndRebateRate(user, token, true);
    return [burnRateMatching.toNumber(), burnRateP2P.toNumber()];
  };

  const getBurnAndRebateRate = async (user: string, token: string, P2P: boolean) => {
    const [burnRate, rebateRate] = await burnRateTable.getBurnAndRebateRate(user, token, P2P);
    return [burnRate.toNumber(), rebateRate.toNumber()];
  };

  const getTokenTierUpgradeAmount = async () => {
    const LRC = await DummyToken.at(tokenLRC);
    const totalLRCSupply = await LRC.totalSupply();
    const upgradeCostPercentage = (await burnRateTable.TIER_UPGRADE_COST_PERCENTAGE()).toNumber();
    const upgradeAmount = Math.floor(totalLRCSupply * upgradeCostPercentage / BURN_BASE_PERCENTAGE);
    return upgradeAmount;
  };

  const getMaxLockAmount = async () => {
    const LRC = await DummyToken.at(tokenLRC);
    const totalLRCSupply = await LRC.totalSupply();

    // Calculate the needed funds to upgrade the tier
    const maxLockPercentage = (await burnRateTable.MAX_LOCK_PERCENTAGE()).toNumber();
    const maxLockAmount = Math.floor(totalLRCSupply * maxLockPercentage / LOCK_BASE_PERCENTAGE);
    return maxLockAmount;
  };

  const getLRCBalance = async (user: string) => {
    const LRC = await DummyToken.at(tokenLRC);
    const balance = (await LRC.balanceOf(user)).toNumber();
    return balance;
  };

  const addLRCBalance = async (user: string, amount: number) => {
    const LRC = await DummyToken.at(tokenLRC);
    await LRC.transfer(user, amount, {from: deployer});
    await LRC.approve(burnRateTable.address, amount, {from: user});
  };

  const checkTokenTier = async (user: string, token: string, expectedTier: number) => {
    const [matchingToken, P2PToken] = await getTokenRate(user, token);
    const [matchingTier, P2PTier] = await getTierRate(expectedTier);
    const tierValue = (await burnRateTable.getTokenTier(token)).toNumber();
    const expectedTierValue = await getTokenTierValue(expectedTier);
    assert.equal(tierValue, expectedTierValue, "Token tier needs to match expected tier");
    assert.equal(matchingToken, matchingTier, "matching rate needs to match tier " + expectedTier + " rate");
    assert.equal(P2PToken, P2PTier, "P2P rate needs to match tier " + expectedTier + " rate");
  };

  const checkRebateRate = async (user: string, expectedRate: number) => {
    const rate = (await burnRateTable.getRebateRate(user)).toNumber();
    assert.equal(rate, expectedRate, "User rebate rate need to match expected rate");
  };

  const checkLRCBalance = async (user: string, expectedBalance: number, description?: string) => {
    const balance = await getLRCBalance(user);
    assertNumberEqualsWithPrecision(balance, expectedBalance,
                                    description ? description : "Balance of the user should match expected balance");
  };

  const checkWithdrawableAmount = async (user: string, expectedAmount: number, allowedDelta: number = 0) => {
    const amount = (await burnRateTable.getWithdrawableBalance(user)).toNumber();
    assert(Math.abs(amount - expectedAmount) <= allowedDelta,
      "Withdrawable amount should roughly match expected amount");
  };

  const checkBalance = async (user: string, expectedBalance: number) => {
    const balance = (await burnRateTable.getBalance(user)).toNumber();
    assert.equal(balance, expectedBalance, "Balance should match expected amount");
  };

  const withdrawChecked = async (user: string, amount: number) => {
    const lrcBalanceBefore = await getLRCBalance(user);
    const withdrawableAmountBefore = (await burnRateTable.getWithdrawableBalance(user)).toNumber();
    const lockedBalanceBefore = (await burnRateTable.getBalance(user)).toNumber();

    // Withdraw
    await burnRateTable.withdraw(amount, {from: user});

    await checkLRCBalance(user, lrcBalanceBefore + amount);
    // Time has advanced so the withdrawable amount could have changed a tiny bit
    await checkWithdrawableAmount(user, withdrawableAmountBefore - amount, lockedBalanceBefore / 100000);
    await checkBalance(user, lockedBalanceBefore - amount);
  };

  const lockChecked = async (user: string, amount: number) => {
    const lrcBalanceBefore = await getLRCBalance(user);
    const lockedBalanceBefore = (await burnRateTable.getBalance(user)).toNumber();
    const lockStartTimeBefore = (await burnRateTable.getLockStartTime(user)).toNumber();

    // Lock the amount
    await burnRateTable.lock(amount, {from: user1});
    const timeAtLock = web3.eth.getBlock(web3.eth.blockNumber).timestamp;

    await checkLRCBalance(user, lrcBalanceBefore - amount,
                          "Balance of the user should be depleted by the locked amount");
    await checkBalance(user, lockedBalanceBefore + amount);

    // Check if the lock start time is correctly updated
    const lockStartTimeAfter = (await burnRateTable.getLockStartTime(user)).toNumber();
    if (lockedBalanceBefore === 0) {
      assert.equal(lockStartTimeBefore, 0, "Lock start time should still be uninitialized");
      assert(Math.abs(lockStartTimeAfter - timeAtLock) < 10);
    } else {
      const timeWeight = amount / (lockedBalanceBefore + amount);
      const expectedNewStartTime = lockStartTimeBefore + (timeAtLock - lockStartTimeBefore) * timeWeight;
      assert(Math.abs(lockStartTimeAfter - expectedNewStartTime) < 10,
             "Lock start time should be updated using the old/new locked amounts as weights");
    }
  };

  before(async () => {
    tokenLRC = LRCToken.address;
    tokenWETH = WETHToken.address;
  });

  beforeEach(async () => {
    // Fresh BurnRateTable and LRC token for each test
    const LRC = await DummyToken.new("Loopring", "LRC", 18, 1e+26);
    tokenLRC = LRC.address;
    burnRateTable = await BurnRateTable.new(tokenLRC, tokenWETH);

    LOCK_TIME = (await burnRateTable.LOCK_TIME()).toNumber();
    LINEAR_UNLOCK_START_TIME = (await burnRateTable.LINEAR_UNLOCK_START_TIME()).toNumber();

    BURN_BASE_PERCENTAGE = (await burnRateTable.BURN_BASE_PERCENTAGE()).toNumber();
    LOCK_BASE_PERCENTAGE = (await burnRateTable.LOCK_BASE_PERCENTAGE()).toNumber();
  });

  describe("Token tiers", () => {
    it("LRC should be tier 1", async () => {
      await checkTokenTier(user1, tokenLRC, 1);
    });

    it("WETH should be tier 3", async () => {
      await checkTokenTier(user1, tokenWETH, 3);
    });

    it("Any other tokens should default to tier 4", async () => {
      await checkTokenTier(user1, token1, 4);
    });

    it("should be able to upgrade the tier of a token for 2 years by burning enough tokens", async () => {
      const LRC = await DummyToken.at(tokenLRC);
      // current total supply
      const totalLRCSupply = await LRC.totalSupply();
      // Total amount needed to upgrate one tier
      const upgradeAmount = await getTokenTierUpgradeAmount();
      // Have the user have a bit more balance
      const initialBalance = upgradeAmount + 1e20;
      // Make sure the user has enough LRC
      await addLRCBalance(user1, initialBalance);

      // Token should still be at tier 4
      await checkTokenTier(user1, token1, 4);
      // Upgrade
      await burnRateTable.upgradeTokenTier(token1, {from: user1});
      // Token should now be at tier 3
      await checkTokenTier(user1, token1, 3);

      // Balance of the owner should have been depleted by the upgrade amount
      checkLRCBalance(user1, initialBalance - upgradeAmount,
                      "Balance of the burner should be depleted by burn amount");
      // New LRC total supply should be upgradeAmount less
      const newTotalLRCSupply = await LRC.totalSupply();
      assertNumberEqualsWithPrecision(
        newTotalLRCSupply, totalLRCSupply - upgradeAmount,
        "LRC total supply should have beed reduces by the amount burned",
      );

      // The tier of the token should still be the same after ~1 year
      await advanceBlockTimestamp(366 * DAY_TO_SECONDS);
      await checkTokenTier(user1, token1, 3);
      // The tier of the token should have reverted back to tier 4 after 2 years
      await advanceBlockTimestamp(366 * DAY_TO_SECONDS);
      await checkTokenTier(user1, token1, 4);
    });

    it("should not be able to upgrade the tier of a token by not burning enough tokens", async () => {
      // Total amount needed to upgrate one tier
      const upgradeAmount = await getTokenTierUpgradeAmount();
      // Not enought funds
      const initialBalance = upgradeAmount / 2;
      await addLRCBalance(user1, initialBalance);
      // Try to upgrade
      await expectThrow(burnRateTable.upgradeTokenTier(token1, {from: user1}));
    });

    it("should not be able to upgrade the tier of LRC or WETH by burning enough tokens", async () => {
      // Total amount needed to upgrate one tier
      const upgradeAmount = await getTokenTierUpgradeAmount();
      // Have the user have a bit more balance
      const initialBalance = upgradeAmount + 1e20;
      // Make sure the user has enough LRC
      await addLRCBalance(user1, initialBalance);
      // Try to upgrade LRC
      await expectThrow(burnRateTable.upgradeTokenTier(tokenLRC, {from: user1}));
      // Try to upgrade WETH
      await expectThrow(burnRateTable.upgradeTokenTier(tokenWETH, {from: user1}));
    });

    it("should not be able to upgrade the tier of a token above tier 1", async () => {
      // Total amount needed to upgrate one tier
      const upgradeAmount = await getTokenTierUpgradeAmount();
      // Have the user have more than enough balance to upgrade multiple times
      const initialBalance = upgradeAmount * 10;
      // Make sure the user has enough LRC
      await addLRCBalance(user1, initialBalance);
      // Tier 4 -> Tier 3
      burnRateTable.upgradeTokenTier(token1, {from: user1});
      // Tier 3 -> Tier 2
      burnRateTable.upgradeTokenTier(token1, {from: user1});
      // Tier 2 -> Tier 1
      burnRateTable.upgradeTokenTier(token1, {from: user1});
      // Tier 1 should be the limit
      await expectThrow(burnRateTable.upgradeTokenTier(token1, {from: user1}));
    });
  });

  describe("LRC locking", () => {
    it("user should be able to lower the burn rate by locking LRC", async () => {
      const maxLockAmount = await getMaxLockAmount();
      // Have the user have a bit more balance
      const initialBalance = maxLockAmount + 1e20;
      await addLRCBalance(user1, initialBalance);

      // Rebate rate should still be at 0%
      await checkRebateRate(user1, 0 * BURN_BASE_PERCENTAGE);

      // Lock the max amount
      await lockChecked(user1, maxLockAmount);

      // Rebate rate needs to be set at 100%
      await checkRebateRate(user1, 1 * BURN_BASE_PERCENTAGE);
      // Rebate rate of another user should still be 0%
      await checkRebateRate(user2, 0 * BURN_BASE_PERCENTAGE);

      // Rebate rate should stay the same until the locking period is over and the user doesn't withdraw any tokens
      // Day 100
      await advanceBlockTimestamp(100 * DAY_TO_SECONDS);
      await checkRebateRate(user1, 1 * BURN_BASE_PERCENTAGE);
      // Day 200
      await advanceBlockTimestamp(100 * DAY_TO_SECONDS);
      await checkRebateRate(user1, 1 * BURN_BASE_PERCENTAGE);
      // Day 300
      await advanceBlockTimestamp(100 * DAY_TO_SECONDS);
      await checkRebateRate(user1, 1 * BURN_BASE_PERCENTAGE);
      // Locking period of 1 year over, back to no rebate
      // Day 370
      await advanceBlockTimestamp(70 * DAY_TO_SECONDS);
      await checkRebateRate(user1, 0 * BURN_BASE_PERCENTAGE);

      // Witdraw all locked tokens
      const withdrawableAmount = (await burnRateTable.getWithdrawableBalance(user1)).toNumber();
      assert.equal(withdrawableAmount, maxLockAmount, "Withdrawable amount should match initialy locked amount");

      await withdrawChecked(user1, maxLockAmount);
    });

    it("user should be able to withdraw tokens after they unlock", async () => {
      const maxLockAmount = await getMaxLockAmount();
      const lockAmount = maxLockAmount / 2;
      const initialBalance = lockAmount;
      await addLRCBalance(user1, initialBalance);

      // Lock the  amount
      await lockChecked(user1, lockAmount);

      // Witdrawable amount should be 0 until LINEAR_UNLOCK_START_TIME seconds have passed
      await checkWithdrawableAmount(user1, 0);

      // Should not be able to withdraw any tokens
      await expectThrow(burnRateTable.withdraw(1, {from: user1}));

      // Advance to just before LINEAR_UNLOCK_START_TIME
      await advanceBlockTimestamp(LINEAR_UNLOCK_START_TIME - 1 * DAY_TO_SECONDS);
      await checkWithdrawableAmount(user1, 0);

      // Advance to just after LINEAR_UNLOCK_START_TIME
      await advanceBlockTimestamp(1.1 * DAY_TO_SECONDS);
      {
        const withdrawableAmount = (await burnRateTable.getWithdrawableBalance(user1)).toNumber();
        assert(withdrawableAmount > 0, "Withdrawable amount should be non-zero");
      }

      // Keep track how much we have withdrawn
      let amountWithdrawn = 0;

      // Day 30 (~1/6th into the unlock period)
      // Should be able to withdraw rougly 1/6th of the total locked amount
      await advanceBlockTimestamp(30.5 * DAY_TO_SECONDS);
      await checkWithdrawableAmount(user1, lockAmount / 6, lockAmount / 100);

      // Day 60 (~2/6th into the unlock period)
      // Should be able to withdraw rougly 2/6th of the total locked amount
      await advanceBlockTimestamp(30.5 * DAY_TO_SECONDS);
      await checkWithdrawableAmount(user1,  2 * lockAmount / 6, lockAmount / 100);

      // Withdraw 1/4th of locked amount
      await withdrawChecked(user1, lockAmount / 4);
      amountWithdrawn += lockAmount / 4;
      // Should not be able to withdraw another 1/4th
      await expectThrow(withdrawChecked(user1, lockAmount / 4));

      // Day 120 (~1/2th into the unlock period)
      // Should be able to withdraw another 1/4th of the initial amount
      await advanceBlockTimestamp(30.5 * DAY_TO_SECONDS);
      await checkWithdrawableAmount(user1,  (lockAmount / 2) - amountWithdrawn, lockAmount / 100);
      await withdrawChecked(user1, lockAmount / 4);
      amountWithdrawn += lockAmount / 4;

      // Advance until the end of the lock period and withdraw all remaining tokens
      await advanceBlockTimestamp(100 * DAY_TO_SECONDS);
      await withdrawChecked(user1, lockAmount - amountWithdrawn);

      // Everything should be as it was before the user locked anything
      await checkWithdrawableAmount(user1, 0);
      await checkBalance(user1, 0);
      await checkLRCBalance(user1, initialBalance);
    });

    it("user should be able to lock tokens at multiple times", async () => {
      // The maximum amount we can lock
      const maxLockAmount = await getMaxLockAmount();
      // Let's have the user first lock 1/4th the maximum amount
      const lockAmount = maxLockAmount / 4;

      // Day 0: Lock the first amount
      const initialBalance = lockAmount;
      await addLRCBalance(user1, initialBalance);
      await lockChecked(user1, lockAmount);
      await checkRebateRate(user1, 0.25 * BURN_BASE_PERCENTAGE);

      // Day 30: unlock an aditional amount
      await advanceBlockTimestamp(30 * DAY_TO_SECONDS);
      await addLRCBalance(user1, initialBalance);
      await lockChecked(user1, lockAmount);
      const timeAtSecondLock = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
      await checkRebateRate(user1, 0.5 * BURN_BASE_PERCENTAGE);

      // Day 60: unlock an aditional amount
      await advanceBlockTimestamp(30 * DAY_TO_SECONDS);
      await addLRCBalance(user1, initialBalance);
      await lockChecked(user1, lockAmount);
      await checkRebateRate(user1, 0.75 * BURN_BASE_PERCENTAGE);

      // Lock start time should be the weighted average of all lock times using the lock amounts,
      // which in the above case is the time at the second lock.
      const lockStartTime = (await burnRateTable.getLockStartTime(user1)).toNumber();
      assert(Math.abs(lockStartTime - timeAtSecondLock) < 100,
              "Lock start time should be updated using the old/new locked amounts as weights");
    });

    it("user should not be able to get more than a 100% rebate", async () => {
      const maxLockAmount = await getMaxLockAmount();
      const lockAmount = maxLockAmount * 2;
      await addLRCBalance(user1, lockAmount);
      await lockChecked(user1, lockAmount);
      await checkRebateRate(user1, 1 * BURN_BASE_PERCENTAGE);
    });

    it("user should not be able to have a higher rebate rate than the initial burn rate", async () => {
      const [burnRateMatchingTier4, burnRateP2PTier4] = await getTierRate(4);

      // User currently has no rebate
      const [burnRateBefore, rebateRateBefore] = await getBurnAndRebateRate(user1, token1, false);
      assert.equal(burnRateBefore, burnRateMatchingTier4, "Default burn rate of token should be tier 4 burn rate");
      assert.equal(rebateRateBefore, 0, "Default rebate rate of a user should 0");

      // Let the user stake the max LRC amount for 100% rebate
      const maxLockAmount = await getMaxLockAmount();
      await addLRCBalance(user1, maxLockAmount);
      await lockChecked(user1, maxLockAmount);
      await checkRebateRate(user1, 1 * BURN_BASE_PERCENTAGE);

      // User should have a 100% rebate rate and the burn rate should be 0%
      const [burnRateAfter, rebateRateAfter] = await getBurnAndRebateRate(user1, token1, false);
      assert.equal(rebateRateAfter, burnRateMatchingTier4, "Rebate rate should match the burn rate");
      assert.equal(burnRateAfter, 0, "Burn rate should have been reduces to 0%");
    });

    it("user should not be able to withdraw 0 tokens", async () => {
      // Should not be able to withdraw 0 tokens
      await expectThrow(burnRateTable.withdraw(0, {from: user1}));
    });

  });
});
