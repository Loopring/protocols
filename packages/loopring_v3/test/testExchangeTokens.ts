import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;
  let loopring: any;
  let exchangeID = 0;

  const getTokenRegistrationCost = async (numTokens: number) => {
    const tokenRegistrationFeeLRCBase = await loopring.tokenRegistrationFeeLRCBase();
    const tokenRegistrationFeeLRCDelta = await loopring.tokenRegistrationFeeLRCDelta();
    const cost = tokenRegistrationFeeLRCBase.add(
      tokenRegistrationFeeLRCDelta.mul(new BN(numTokens))
    );
    return cost;
  };

  const registerTokenChecked = async (token: string, user: string) => {
    const tokenAddress = exchangeTestUtil.getTokenAddress(token);
    const LRC = await exchangeTestUtil.getTokenContract("LRC");

    // Total amount needed to uregister a token
    const registrationCost = await exchange.getLRCFeeForRegisteringOneMoreToken();

    const lrcBalanceBefore = await exchangeTestUtil.getOnchainBalance(
      user,
      "LRC"
    );
    const lrcSupplyBefore = await LRC.totalSupply();

    await exchange.registerToken(tokenAddress, { from: user });

    const eventArr: any = await exchangeTestUtil.getEventsFromContract(
      exchange,
      "TokenRegistered",
      web3.eth.blockNumber
    );
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.token, eventObj.args.tokenId];
    });
    const tokenAddressEvent = items[0][0];
    const tokenIdEvent = items[0][1].toNumber();

    const lrcBalanceAfter = await exchangeTestUtil.getOnchainBalance(
      user,
      "LRC"
    );
    const lrcSupplyAfter = await LRC.totalSupply();

    assert(
      lrcBalanceAfter.eq(lrcBalanceBefore.sub(registrationCost)),
      "LRC balance of exchange owner needs to be reduced by registration cost"
    );

    // Transfer LRC to FeeVault instead of burn, so totalSupply will not change.
    // assert(
    //   lrcSupplyAfter.eq(lrcSupplyBefore.sub(registrationCost)),
    //   "LRC supply needs to be reduced by registration cost"
    // );

    const tokenIdContract = await exchange.getTokenID(tokenAddress);
    const tokenAddressContract = await exchange.getTokenAddress(tokenIdEvent);

    assert.equal(tokenIdEvent, tokenIdContract, "Token ID does not match");
    assert.equal(
      tokenAddressEvent,
      tokenAddress,
      "Token adress does not match"
    );
    assert.equal(
      tokenAddressContract,
      tokenAddress,
      "Token adress does not match"
    );
  };

  const createExchange = async (bSetupTestState: boolean = true) => {
    exchangeID = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      bSetupTestState
    );
    exchange = exchangeTestUtil.exchange;
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    exchange = exchangeTestUtil.exchange;
    loopring = exchangeTestUtil.loopringV3;
    exchangeID = 1;
  });

  describe("Tokens", function() {
    this.timeout(0);

    describe("exchange owner", () => {
      it("should be able to register a token", async () => {
        await createExchange(false);

        // Make sure the exchange owner has enough LRC
        const registrationCost = await exchange.getLRCFeeForRegisteringOneMoreToken();
        await exchangeTestUtil.setBalanceAndApprove(
          exchangeTestUtil.exchangeOwner,
          "LRC",
          registrationCost
        );

        // Register the token
        await registerTokenChecked("GTO", exchangeTestUtil.exchangeOwner);
      });

      it("should not be able to register a token multiple times", async () => {
        await createExchange(false);

        // Make sure the exchange owner has enough LRC
        const registrationCost = await exchange.getLRCFeeForRegisteringOneMoreToken();
        await exchangeTestUtil.setBalanceAndApprove(
          exchangeTestUtil.exchangeOwner,
          "LRC",
          registrationCost
        );

        // Register the token
        await registerTokenChecked("GTO", exchangeTestUtil.exchangeOwner);

        // Try to register the token again
        await expectThrow(
          exchange.registerToken(exchangeTestUtil.getTokenAddress("GTO"), {
            from: exchangeTestUtil.exchangeOwner
          }),
          "TOKEN_ALREADY_EXIST"
        );
      });
    });

    describe("anyone", () => {
      it("should not be able to register a token", async () => {
        await createExchange(false);
        const token = exchangeTestUtil.getTokenAddress("GTO");
        await expectThrow(
          exchange.registerToken(token, {
            from: exchangeTestUtil.testContext.orderOwners[0]
          }),
          "UNAUTHORIZED"
        );
      });

      it("should not be able to get the token ID for an unregistered token", async () => {
        await createExchange(false);
        const token = exchangeTestUtil.getTokenAddress("GTO");
        await expectThrow(exchange.getTokenID(token), "TOKEN_NOT_FOUND");
      });

      it("should not be able to get the token address for an invalid token ID", async () => {
        await createExchange(false);
        await expectThrow(exchange.getTokenAddress(123), "INVALID_TOKEN_ID");
      });
    });

    it("token registration cost should be as expected", async () => {
      await createExchange(false);

      let numTokens = 3;
      let expectedCost = await getTokenRegistrationCost(numTokens);
      let registrationCost = await exchange.getLRCFeeForRegisteringOneMoreToken();
      assert(
        registrationCost.eq(expectedCost),
        "token registration cost not as expected"
      );

      // Register the token
      await exchangeTestUtil.setBalanceAndApprove(
        exchangeTestUtil.exchangeOwner,
        "LRC",
        registrationCost
      );
      await registerTokenChecked("GTO", exchangeTestUtil.exchangeOwner);
      numTokens++;

      expectedCost = await getTokenRegistrationCost(numTokens);
      registrationCost = await exchange.getLRCFeeForRegisteringOneMoreToken();
      assert(
        registrationCost.eq(expectedCost),
        "token registration cost not as expected"
      );
    });

    it("LRC, ETH and WETH should be preregistered", async () => {
      await createExchange(false);

      // Make sure the exchange owner has enough LRC
      const registrationCost = await exchange.getLRCFeeForRegisteringOneMoreToken();
      await exchangeTestUtil.setBalanceAndApprove(
        exchangeTestUtil.exchangeOwner,
        "LRC",
        registrationCost
      );

      // Try to register LRC
      await expectThrow(
        exchange.registerToken(exchangeTestUtil.getTokenAddress("LRC"), {
          from: exchangeTestUtil.exchangeOwner
        }),
        "TOKEN_ALREADY_EXIST"
      );
      // Try to register ETH
      await expectThrow(
        exchange.registerToken(exchangeTestUtil.getTokenAddress("ETH"), {
          from: exchangeTestUtil.exchangeOwner
        }),
        "TOKEN_ALREADY_EXIST"
      );
      // Try to register WETH
      await expectThrow(
        exchange.registerToken(exchangeTestUtil.getTokenAddress("WETH"), {
          from: exchangeTestUtil.exchangeOwner
        }),
        "TOKEN_ALREADY_EXIST"
      );
    });
  });
});
