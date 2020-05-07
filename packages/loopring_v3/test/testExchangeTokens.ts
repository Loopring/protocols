import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { BalanceSnapshot, ExchangeTestUtil } from "./testExchangeUtil";

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
    // LRC cost to register a token
    const registrationCost = await exchange.getLRCFeeForRegisteringOneMoreToken();

    const lrc = (await exchangeTestUtil.contracts.LRCToken.deployed()).address;
    const snapshot = new BalanceSnapshot(exchangeTestUtil);
    await snapshot.watchBalance(exchange.address, lrc, "exchange");
    await snapshot.watchBalance(
      exchangeTestUtil.depositContract.address,
      lrc,
      "depositContract"
    );
    await snapshot.transfer(
      user,
      exchangeTestUtil.protocolFeeVault,
      lrc,
      registrationCost,
      "user",
      "protocolFeeVault"
    );

    await exchange.registerToken(tokenAddress, { from: user });

    // Verify balances
    await snapshot.verifyBalances();

    // Check the TokenRegistered event
    const event = await exchangeTestUtil.assertEventEmitted(
      exchange,
      "TokenRegistered"
    );
    const tokenIdContract = await exchange.getTokenID(tokenAddress);
    const tokenAddressContract = await exchange.getTokenAddress(event.tokenId);
    assert.equal(
      event.tokenId.toNumber(),
      tokenIdContract,
      "Token ID does not match"
    );
    assert.equal(event.token, tokenAddress, "Token adress does not match");
    assert.equal(
      event.token,
      tokenAddressContract,
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

  after(async () => {
    await exchangeTestUtil.stop();
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
          registrationCost,
          exchangeTestUtil.exchange.address
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
          registrationCost,
          exchangeTestUtil.exchange.address
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
        registrationCost,
        exchangeTestUtil.exchange.address
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
        registrationCost,
        exchangeTestUtil.exchange.address
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
