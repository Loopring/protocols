import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";

contract("Loopring", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;
  let loopring: any;

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

  const withdrawTheBurnChecked = async (token: string, recipient: string, expectedAmount: BN) => {
    const tokenAddress = exchangeTestUtil.getTokenAddress(token);

    const balanceRecipientBefore = await exchangeTestUtil.getOnchainBalance(recipient, tokenAddress);
    const balanceContractBefore = await exchangeTestUtil.getOnchainBalance(loopring.address, tokenAddress);

    await loopring.withdrawTheBurn(tokenAddress, recipient,
                                   {from: exchangeTestUtil.testContext.deployer, gasPrice: 0});

    const balanceRecipientAfter = await exchangeTestUtil.getOnchainBalance(recipient, tokenAddress);
    const balanceContractAfter = await exchangeTestUtil.getOnchainBalance(loopring.address, tokenAddress);

    assert(balanceRecipientAfter.eq(balanceRecipientBefore.add(expectedAmount)),
           "Token balance of recipient should be increased by amount");
    assert(balanceContractAfter.eq(balanceContractBefore.sub(expectedAmount)),
           "Token balance of contract should be decreased by amount");
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

  describe("Owner", () => {
    it("should be able to withdraw 'The Burn'", async () => {
      const user = exchangeTestUtil.testContext.orderOwners[0];
      const amountA = new BN(web3.utils.toWei("1.23", "ether"));
      const amountB = new BN(web3.utils.toWei("456", "ether"));
      await exchangeTestUtil.setBalanceAndApprove(user, "WETH", amountB, loopring.address);
      // Transfer some funds to the contract that we can withdraw
      // ETH
      await web3.eth.sendTransaction({from: user, to: loopring.address, value: amountA});
      // WETH
      const WETH = await exchangeTestUtil.getTokenContract("WETH");
      await WETH.transfer(loopring.address, amountB, {from: user});

      // Withdraw
      const recipient = exchangeTestUtil.testContext.orderOwners[1];
      // ETH
      await withdrawTheBurnChecked("ETH", recipient, amountA);
      // WETH
      await withdrawTheBurnChecked("WETH", recipient, amountB);
    });

    it("should not be able to withdraw any LRC", async () => {
      const user = exchangeTestUtil.testContext.orderOwners[0];
      const amount = new BN(web3.utils.toWei("123.456", "ether"));
      await exchangeTestUtil.setBalanceAndApprove(user, "LRC", amount, loopring.address);
      // Transfer some funds to the contract that we can withdraw
      const LRC = await exchangeTestUtil.getTokenContract("LRC");
      await LRC.transfer(loopring.address, amount, {from: user});

      // Withdraw
      const recipient = exchangeTestUtil.testContext.orderOwners[1];
      // LRC
      await expectThrow(
        loopring.withdrawTheBurn(exchangeTestUtil.getTokenAddress("LRC"), recipient,
        {from: exchangeTestUtil.testContext.deployer}),
        "LRC_ALREADY_BURNED",
      );
    });

    it("should not be able to withdraw any LRC", async () => {
      const user = exchangeTestUtil.testContext.orderOwners[0];
      const amount = new BN(web3.utils.toWei("123.456", "ether"));
      await exchangeTestUtil.setBalanceAndApprove(user, "LRC", amount, loopring.address);
      // Transfer some funds to the contract that we can withdraw
      const LRC = await exchangeTestUtil.getTokenContract("LRC");
      await LRC.transfer(loopring.address, amount, {from: user});

      // Withdraw
      const recipient = exchangeTestUtil.testContext.orderOwners[1];
      // LRC
      await expectThrow(
        loopring.withdrawTheBurn(exchangeTestUtil.getTokenAddress("LRC"), recipient,
        {from: exchangeTestUtil.testContext.deployer}),
        "LRC_ALREADY_BURNED",
      );
    });
  });

  describe("anyone", () => {
    it("should not be able to withdraw 'The Burn'", async () => {
      const user = exchangeTestUtil.testContext.orderOwners[0];
      const amountA = new BN(web3.utils.toWei("1.23", "ether"));
      const amountB = new BN(web3.utils.toWei("456", "ether"));
      await exchangeTestUtil.setBalanceAndApprove(user, "WETH", amountB, loopring.address);
      // Transfer some funds to the contract that we can withdraw
      // ETH
      await web3.eth.sendTransaction({from: user, to: loopring.address, value: amountA});
      // WETH
      const WETH = await exchangeTestUtil.getTokenContract("WETH");
      await WETH.transfer(loopring.address, amountB, {from: user});

      // Try to withdraw
      const recipient = exchangeTestUtil.testContext.orderOwners[1];
      // ETH
      await expectThrow(
        loopring.withdrawTheBurn(exchangeTestUtil.getTokenAddress("ETH"), recipient, {from: recipient}),
        "UNAUTHORIZED",
      );
      // WETH
      await expectThrow(
        loopring.withdrawTheBurn(exchangeTestUtil.getTokenAddress("WETH"), recipient, {from: recipient}),
        "UNAUTHORIZED",
      );
    });

    it("should not be to burn the complete stake", async () => {
      await expectThrow(
        loopring.burnAllStake(exchangeTestUtil.exchangeId,
        {from: exchangeTestUtil.testContext.deployer}),
        "UNAUTHORIZED",
      );
    });

    it("should not be to burn the stake", async () => {
      await expectThrow(
        loopring.burnStake(exchangeTestUtil.exchangeId, new BN(0),
        {from: exchangeTestUtil.testContext.deployer}),
        "UNAUTHORIZED",
      );
    });

    it("should not be able to withdraw the stake", async () => {
      const recipient = exchangeTestUtil.testContext.orderOwners[1];
      await expectThrow(
        loopring.withdrawStake(exchangeTestUtil.exchangeId, recipient, new BN(0),
        {from: exchangeTestUtil.testContext.deployer}),
        "UNAUTHORIZED",
      );
    });
  });
});
