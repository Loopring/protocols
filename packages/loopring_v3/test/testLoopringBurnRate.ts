import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";

contract("Loopring", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;
  let loopring: any;

  const zeroAddress = "0x" + "00".repeat(20);

  const checkBurnRate = async (token: string, expectedBurnRate: BN) => {
    const tokenAddress = exchangeTestUtil.getTokenAddress(token);
    const burnRate = await loopring.getTokenBurnRate(tokenAddress);
    assert(burnRate.eq(expectedBurnRate), "Token burn rate needs to match expected burn rate");
  };

  const getTokenTierUpgradeAmount = async () => {
    const LRC = await exchangeTestUtil.getTokenContract("LRC");
    const LRCSupply = await LRC.totalSupply();
    const tierUpgradeCostBips = await loopring.tierUpgradeCostBips();
    const upgradeAmount = LRCSupply.mul(tierUpgradeCostBips).div(new BN(100 * 100));
    return upgradeAmount;
  };

  const buydownTokenBurnRateChecked = async (token: string, user: string) => {
    const tokenAddress = exchangeTestUtil.getTokenAddress(token);
    const LRC = await exchangeTestUtil.getTokenContract("LRC");
    // Total amount needed to upgrate one tier
    const upgradeAmount = await getTokenTierUpgradeAmount();

    const lrcBalanceBefore = await exchangeTestUtil.getOnchainBalance(user, "LRC");
    const lrcSupplyBefore = await LRC.totalSupply();

    await loopring.buydownTokenBurnRate(tokenAddress, {from: user});

    const lrcBalanceAfter = await exchangeTestUtil.getOnchainBalance(user, "LRC");
    const lrcSupplyAfter = await LRC.totalSupply();

    assert(lrcBalanceAfter.eq(lrcBalanceBefore.sub(upgradeAmount)),
           "LRC balance of user needs to be reduced by upgradeAmount");
    assert(lrcSupplyAfter.eq(lrcSupplyBefore.sub(upgradeAmount)),
           "LRC supply needs to be reduced by upgradeAmount");
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    loopring = exchangeTestUtil.loopringV3;
  });

  describe("Burn rate", function() {
    this.timeout(0);

    it("LRC should be tier 1", async () => {
      await checkBurnRate("LRC", exchangeTestUtil.BURNRATE_TIER1);
    });

    it("ETH should be tier 3", async () => {
      await checkBurnRate("ETH", exchangeTestUtil.BURNRATE_TIER3);
    });

    it("WETH should be tier 3", async () => {
      await checkBurnRate("WETH", exchangeTestUtil.BURNRATE_TIER3);
    });

    it("Any other tokens should default to tier 4", async () => {
      await checkBurnRate("GTO", exchangeTestUtil.BURNRATE_TIER4);
    });

    it("Upgrade cost should match expected value", async () => {
      const token = "GTO";
      const upgradeAmountExpected = await getTokenTierUpgradeAmount();
      const upgradeData = await loopring.getLRCCostToBuydownTokenBurnRate(exchangeTestUtil.getTokenAddress(token));
      assert(upgradeAmountExpected.eq(upgradeData.amountLRC), "Upgrade cost not as expected");
    });

    it("should be able to upgrade the tier of a token for 1 year by burning enough tokens", async () => {
      const user = exchangeTestUtil.testContext.orderOwners[0];
      const token = "GTO";

      // Try to buy down the burn rate without sufficient funds
      await expectThrow(
        loopring.buydownTokenBurnRate(exchangeTestUtil.getTokenAddress(token), {from: user}),
        "BURNFROM_INSUFFICIENT_BALANCE",
      );

      // Total amount needed to upgrate one tier
      const upgradeAmount = await getTokenTierUpgradeAmount();

      // Make sure the user has enough LRC
      await exchangeTestUtil.setBalanceAndApprove(user, "LRC", upgradeAmount, loopring.address);

      // Token should still be at tier 4
      await checkBurnRate(token, exchangeTestUtil.BURNRATE_TIER4);
      // Upgrade
      await buydownTokenBurnRateChecked(token, user);
      // Token should now be at tier 3
      await checkBurnRate(token, exchangeTestUtil.BURNRATE_TIER3);

      // The tier of the token should still be the same within 1 year
      await exchangeTestUtil.advanceBlockTimestamp(exchangeTestUtil.TIER_UPGRADE_DURATION - 100);
      await checkBurnRate(token, exchangeTestUtil.BURNRATE_TIER3);
      // The tier of the token should have reverted back to tier 4 after 1 year
      await exchangeTestUtil.advanceBlockTimestamp(200);
      await checkBurnRate(token, exchangeTestUtil.BURNRATE_TIER4);
    });

    it("should not be able to upgrade the tier of a token above tier 1", async () => {
      const user = exchangeTestUtil.testContext.orderOwners[0];
      const token = "GTO";

      // Total amount needed to upgrate one tier
      const upgradeAmount = await getTokenTierUpgradeAmount();

      // Make sure the user has more than enough LRC
      await exchangeTestUtil.setBalanceAndApprove(user, "LRC", upgradeAmount.mul(new BN(10)), loopring.address);

      await checkBurnRate(token, exchangeTestUtil.BURNRATE_TIER4);
      // Tier 4 -> Tier 3
      await buydownTokenBurnRateChecked(token, user);
      await checkBurnRate(token, exchangeTestUtil.BURNRATE_TIER3);
      // Tier 3 -> Tier 2
      await buydownTokenBurnRateChecked(token, user);
      await checkBurnRate(token, exchangeTestUtil.BURNRATE_TIER2);
      // Tier 2 -> Tier 1
      await buydownTokenBurnRateChecked(token, user);
      await checkBurnRate(token, exchangeTestUtil.BURNRATE_TIER1);
      // Tier 1 should be the limit
      await expectThrow(
        loopring.buydownTokenBurnRate(exchangeTestUtil.getTokenAddress(token), {from: user}),
        "BURN_RATE_MINIMIZED",
      );
    });

    it("should not be able to upgrade the tier of LRC/ETH/WETH by burning enough tokens", async () => {
      const user = exchangeTestUtil.testContext.orderOwners[0];
      // Total amount needed to upgrate one tier
      const upgradeAmount = await getTokenTierUpgradeAmount();
      // Make sure the user has enough LRC
      await exchangeTestUtil.setBalanceAndApprove(user, "LRC", upgradeAmount, loopring.address);

      // Try to upgrade the tokens
      const fixedTokens = ["LRC", "ETH", "WETH"];
      for (const token of fixedTokens) {
        await expectThrow(
          loopring.buydownTokenBurnRate(exchangeTestUtil.getTokenAddress(token), {from: user}),
          "BURN_RATE_FROZEN",
        );
      }
    });

  });
});
