import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { BalanceSnapshot, ExchangeTestUtil } from "./testExchangeUtil";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;
  let loopring: any;
  let exchangeID = 0;

  const registerTokenChecked = async (token: string, user: string) => {
    const tokenAddress = exchangeTestUtil.getTokenAddress(token);

    const lrc = (await exchangeTestUtil.contracts.LRCToken.deployed()).address;
    const snapshot = new BalanceSnapshot(exchangeTestUtil);
    await snapshot.watchBalance(exchange.address, lrc, "exchange");
    await snapshot.watchBalance(
      exchangeTestUtil.depositContract.address,
      lrc,
      "depositContract"
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

  const createExchange = async (setupTestState: boolean = true) => {
    exchangeID = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      {setupTestState, useOwnerContract: false}
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

        // Register the token
        await registerTokenChecked("GTO", exchangeTestUtil.exchangeOwner);
      });

      it("should not be able to register a token multiple times", async () => {
        await createExchange(false);

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

    it("LRC and ETH should be preregistered", async () => {
      await createExchange(false);

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
    });
  });
});
