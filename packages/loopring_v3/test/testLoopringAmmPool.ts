import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { Constants } from "loopringv3.js";
import { AuthMethod, OrderInfo, SpotTrade } from "./types";

contract("LoopringAmmPool", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;

  let exchangeID = 0;
  let operatorAccountID: number;
  let operator: string;

  let loopringAmmPool: any;
  let loopringAmmSharedConfig: any;
  let exchange: any;
  let ownerContract: any;
  let depositContractAddr: string;
  let ownerA: string;
  let ownerB: string;

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

    ownerA = exchangeTestUtil.testContext.orderOwners[0];
    ownerB = exchangeTestUtil.testContext.orderOwners[1];
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  beforeEach(async () => {
    // Fresh Exchange for each test
    exchangeID = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      { setupTestState: true, useOwnerContract: true }
    );
    operatorAccountID = await exchangeTestUtil.getActiveOperator(exchangeID);
    operator = exchangeTestUtil.getAccount(operatorAccountID).owner;
    exchange = exchangeTestUtil.exchange;
    const ownerContractAddress = await exchange.owner();
    ownerContract = await artifacts
      .require("LoopringIOExchangeOwner")
      .at(ownerContractAddress);

    // grant registerToken to exchangeOwner:
    await ownerContract.grantAccess(
      exchangeTestUtil.exchangeOwner,
      web3.eth.abi.encodeFunctionSignature("registerToken(address)"),
      true,
      { from: exchangeTestUtil.exchangeOwner }
    );

    // register LP token:
    const registerTokenData = exchange.contract.methods
      .registerToken(loopringAmmPool.address)
      .encodeABI();
    await ownerContract.transact(registerTokenData, {
      from: exchangeTestUtil.exchangeOwner
    });

    depositContractAddr = await exchange.getDepositContract();
  });

  describe("LoopringAmmPool", function() {
    this.timeout(0);

    it("Successful swap (AMM maker)", async () => {
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
        exchange: exchange.address,
        poolName: "LRC-ETH",
        accountID: 10,
        tokens: [lrcAddr, ethAddr],
        weights: [1, 1],
        feeBips: 10,
        tokenSymbol: "LPLRCETH"
      };

      await loopringAmmPool.setupPool(poolConfig);

      // joinPool on L2:

      // const ring: SpotTrade = {
      //   orderA: {
      //     owner: loopringAmmPool.contract.address,
      //     tokenS: "WETH",
      //     tokenB: "GTO",
      //     amountS: new BN(web3.utils.toWei("98", "ether")),
      //     amountB: new BN(web3.utils.toWei("200", "ether")),
      //     feeBips: 0,
      //     amm: true
      //   },
      //   orderB: {
      //     tokenS: "GTO",
      //     tokenB: "WETH",
      //     amountS: new BN(web3.utils.toWei("200", "ether")),
      //     amountB: new BN(web3.utils.toWei("98", "ether"))
      //   },
      //   expected: {
      //     orderA: { filledFraction: 1.0, spread: new BN(0) },
      //     orderB: { filledFraction: 1.0 }
      //   }
      // };
      // await exchangeTestUtil.setupRing(ring, true, true, false, true);

      // await exchangeTestUtil.deposit(
      //   exchangeTestUtil.exchangeOperator,
      //   exchangeTestUtil.exchangeOperator,
      //   ring.orderA.tokenB,
      //   ring.orderA.amountB
      // );

      // await exchangeTestUtil.sendRing(ring);
      // await exchangeTestUtil.submitTransactions();
      // await exchangeTestUtil.submitPendingBlocks();
    });
  });
});
