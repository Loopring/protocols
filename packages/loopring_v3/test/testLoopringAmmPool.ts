import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { Constants } from "loopringv3.js";

contract("LoopringAmmPool", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;

  let exchangeID = 0;
  let operatorAccountID: number;
  let operator: string;

  let loopringAmmPool: any;
  let loopringAmmSharedConfig: any;
  let exchange: any;
  let depositContractAddr: string;

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    exchangeID = 1;

    loopringAmmPool = await artifacts.require("LoopringAmmPool").deployed();
    // console.log("loopringAmmPool address", loopringAmmPool.address);

    loopringAmmSharedConfig = await artifacts
      .require("LoopringAmmSharedConfig")
      .new();
    await loopringAmmSharedConfig.setMaxForcedExitAge(3600 * 24 * 7);
    await loopringAmmSharedConfig.setMaxForcedExitCount(100);
    await loopringAmmSharedConfig.setForcedExitFee(
      web3.utils.toWei("0.001", "ether")
    );
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  beforeEach(async () => {
    // Fresh Exchange for each test
    exchangeID = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      { setupTestState: true, useOwnerContract: false }
    );
    operatorAccountID = await exchangeTestUtil.getActiveOperator(exchangeID);
    operator = exchangeTestUtil.getAccount(operatorAccountID).owner;
    exchange = exchangeTestUtil.exchange;
    // console.log("exchange address:", exchange.address);

    // register LP token:
    await exchange.registerToken(loopringAmmPool.address, {
      from: exchangeTestUtil.testContext.stateOwners[0]
    });

    depositContractAddr = await exchange.getDepositContract();
    // console.log("depositContractAddr:", depositContractAddr);
    // const tokenId = await exchangeTestUtil.exchange.getTokenID(loopringAmmPool.address);
    // console.log("tokenId", tokenId);
  });

  describe("LoopringAmmPool", function() {
    this.timeout(0);

    it.only("Should be able to setup and mint all LP token to exchange", async () => {
      const ethAddr = exchangeTestUtil.testContext.tokenSymbolAddrMap.get(
        "ETH"
      );
      const lrcAddr = exchangeTestUtil.testContext.tokenSymbolAddrMap.get(
        "LRC"
      );

      // register AmmPool as an account in exchange:
      await exchangeTestUtil.deposit(
        exchangeTestUtil.testContext.operators[0],
        loopringAmmPool.address,
        Constants.zeroAddress,
        web3.utils.toBN(0),
        {
          autoSetKeys: false
        }
      );

      const poolConfig = {
        sharedConfig: loopringAmmSharedConfig.address,
        exchange: exchangeTestUtil.exchange.address,
        poolName: "LRC-ETH",
        accountID: 10,
        tokens: [lrcAddr, ethAddr],
        weights: [1, 1],
        feeBips: 10,
        tokenSymbol: "LPLRCETH"
      };

      await loopringAmmPool.setupPool(poolConfig);
    });
  });
});
