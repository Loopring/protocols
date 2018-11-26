import * as pjs from "protocol2-js";
import { Artifacts } from "../util/Artifacts";
import { ringsInfoList } from "./rings_config";
import { ExchangeTestUtil } from "./testExchangeUtil";

const {
  DummyExchange,
  DeserializerTest,
} = new Artifacts(artifacts);

contract("Exchange_Submit_gas_usage", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  let dummyExchange: any;
  let deserializerTest: any;

  const checkFilled = async (order: pjs.OrderInfo, expected: number) => {
    const filled = await exchangeTestUtil.context.tradeDelegate.filled("0x" + order.hash.toString("hex")).toNumber();
    assert.equal(filled, expected, "Order fill different than expected");
  };

  const showCallDataStats = (callData: string)  => {
    // console.log("Call data: " + callData);
    let callDataCost = 0;
    for (let i = 0; i < callData.length; i += 2) {
      if (callData.slice(i, i + 2) === "00") {
        callDataCost += 4;
      } else {
        callDataCost += 68;
      }
    }
    pjs.logDebug("Call data cost: " + callDataCost);
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    deserializerTest = await DeserializerTest.deployed();

    // Create dummy exchange and authorize it
    dummyExchange = await DummyExchange.new(exchangeTestUtil.context.tradeDelegate.address,
                                            exchangeTestUtil.context.tradeHistory.address,
                                            exchangeTestUtil.context.feeHolder.address,
                                            exchangeTestUtil.ringSubmitter.address);
    await exchangeTestUtil.context.tradeDelegate.authorizeAddress(dummyExchange.address,
                                                                  {from: exchangeTestUtil.testContext.deployer});
  });

  describe("submitRing", () => {
    it("single 2-size ring, with price gap", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            index: 0,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 100e18,
            amountB: 10e18,
            balanceS: 1e21,
            balanceFee: 1e21,
            balanceB: 1e21,
          },
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 5e18,
            amountB: 45e18,
            balanceS: 1e21,
            balanceFee: 1e21,
            balanceB: 1e21,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      await exchangeTestUtil.submitRingsAndSimulate(ringsInfo, dummyExchange);
    });

    it("single 3-size ring, with price gap", async () => {
      const ringsInfo: pjs.RingsInfo = {
        description: "simple single 3-size ring, with price gap",
        rings: [[0, 1, 2]],
        orders: [
          {
            index: 0,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 100e18,
            amountB: 10e18,
            balanceS: 1e21,
            balanceFee: 1e21,
            balanceB: 1e21,
          },
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "REP",
            amountS: 5e18,
            amountB: 45e18,
            balanceS: 1e21,
            balanceFee: 1e21,
            balanceB: 1e21,
          },
          {
            index: 2,
            tokenS: "REP",
            tokenB: "WETH",
            amountS: 3e18,
            amountB: 2e18,
            balanceS: 1e21,
            balanceFee: 1e21,
            balanceB: 1e21,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      await exchangeTestUtil.submitRingsAndSimulate(ringsInfo, dummyExchange);
    });

    it("single 3-size ring, with price gap, same dual author", async () => {
      const ringsInfo: pjs.RingsInfo = {
        description: "simple single 3-size ring, with price gap",
        rings: [[0, 1, 2]],
        orders: [
          {
            index: 0,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 100e18,
            amountB: 10e18,
            dualAuthAddr: "0",
            balanceS: 1e21,
            balanceFee: 1e21,
            balanceB: 1e21,
          },
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "REP",
            amountS: 5e18,
            amountB: 45e18,
            dualAuthAddr: "0",
            balanceS: 1e21,
            balanceFee: 1e21,
            balanceB: 1e21,
          },
          {
            index: 2,
            tokenS: "REP",
            tokenB: "WETH",
            amountS: 3e18,
            amountB: 2e18,
            dualAuthAddr: "0",
            balanceS: 1e21,
            balanceFee: 1e21,
            balanceB: 1e21,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      await exchangeTestUtil.submitRingsAndSimulate(ringsInfo, dummyExchange);
    });
  });

  describe("submitRing deserialization", () => {
    it("single 2-size ring, everything unique", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            index: 0,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 100e18,
            amountB: 10e18,
            feeAmount: 1e18,
            walletAddr: "0",
            dualAuthAddr: "0",
          },
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 5e18,
            amountB: 45e18,
            feeAmount: 2e18,
            walletAddr: "1",
            dualAuthAddr: "1",
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      const callData = await exchangeTestUtil.deserializeRing(ringsInfo);
      const tx = await deserializerTest.deserialize(callData);
      pjs.logInfo("\x1b[46m%s\x1b[0m", "gas used: " + tx.receipt.gasUsed);
      showCallDataStats(callData);
    });

    it("single 2-size ring, wallet shared", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            index: 0,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 100e18,
            amountB: 10e18,
            feeAmount: 1e18,
            walletAddr: "0",
            dualAuthAddr: "0",
          },
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 5e18,
            amountB: 45e18,
            feeAmount: 2e18,
            walletAddr: "0",
            dualAuthAddr: "1",
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      const callData = await exchangeTestUtil.deserializeRing(ringsInfo);
      const tx = await deserializerTest.deserialize(callData);
      pjs.logInfo("\x1b[46m%s\x1b[0m", "gas used: " + tx.receipt.gasUsed);
      showCallDataStats(callData);
    });

    it("single 2-size ring, dual author shared", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            index: 0,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 100e18,
            amountB: 10e18,
            feeAmount: 1e18,
            walletAddr: "0",
            dualAuthAddr: "0",
          },
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 5e18,
            amountB: 45e18,
            feeAmount: 2e18,
            walletAddr: "1",
            dualAuthAddr: "0",
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      const callData = await exchangeTestUtil.deserializeRing(ringsInfo);
      const tx = await deserializerTest.deserialize(callData);
      pjs.logInfo("\x1b[46m%s\x1b[0m", "gas used: " + tx.receipt.gasUsed);
      showCallDataStats(callData);
    });

    it("single 2-size ring, fee token the same (not LRC)", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            index: 0,
            tokenS: "GTO",
            tokenB: "LRC",
            feeToken: "WETH",
            amountS: 100e18,
            amountB: 10e18,
            feeAmount: 1e18,
            walletAddr: "0",
            dualAuthAddr: "0",
          },
          {
            index: 1,
            tokenS: "LRC",
            tokenB: "GTO",
            feeToken: "WETH",
            amountS: 5e18,
            amountB: 45e18,
            feeAmount: 2e18,
            walletAddr: "1",
            dualAuthAddr: "1",
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      const callData = await exchangeTestUtil.deserializeRing(ringsInfo);
      const tx = await deserializerTest.deserialize(callData);
      pjs.logInfo("\x1b[46m%s\x1b[0m", "gas used: " + tx.receipt.gasUsed);
      showCallDataStats(callData);
    });

    it("single 2-size ring, prices match", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            index: 0,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 100e18,
            amountB: 10e18,
            feeAmount: 1e18,
            walletAddr: "0",
            dualAuthAddr: "0",
          },
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 10e18,
            amountB: 100e18,
            feeAmount: 2e18,
            walletAddr: "1",
            dualAuthAddr: "1",
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      const callData = await exchangeTestUtil.deserializeRing(ringsInfo);
      const tx = await deserializerTest.deserialize(callData);
      pjs.logInfo("\x1b[46m%s\x1b[0m", "gas used: " + tx.receipt.gasUsed);
      showCallDataStats(callData);
    });

    it("single 3-size ring, everything unique", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            index: 0,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 100e18,
            amountB: 10e18,
            feeAmount: 7e18,
            walletAddr: "0",
            dualAuthAddr: "0",
          },
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "LRC",
            amountS: 5e18,
            amountB: 45e18,
            feeAmount: 8e18,
            walletAddr: "1",
            dualAuthAddr: "1",
          },
          {
            index: 2,
            tokenS: "LRC",
            tokenB: "WETH",
            amountS: 3e18,
            amountB: 2e18,
            feeAmount: 9e18,
            walletAddr: "2",
            dualAuthAddr: "2",
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      const callData = await exchangeTestUtil.deserializeRing(ringsInfo);
      const tx = await deserializerTest.deserialize(callData);
      pjs.logInfo("\x1b[46m%s\x1b[0m", "gas used: " + tx.receipt.gasUsed);
      showCallDataStats(callData);
    });

    it("single 3-size ring, fee token the same (not LRC)", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            index: 0,
            tokenS: "WETH",
            tokenB: "GTO",
            feeToken: "REP",
            amountS: 100e18,
            amountB: 10e18,
            feeAmount: 7e18,
            walletAddr: "0",
            dualAuthAddr: "0",
          },
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "LRC",
            feeToken: "REP",
            amountS: 5e18,
            amountB: 45e18,
            feeAmount: 8e18,
            walletAddr: "1",
            dualAuthAddr: "1",
          },
          {
            index: 2,
            tokenS: "LRC",
            tokenB: "WETH",
            feeToken: "REP",
            amountS: 3e18,
            amountB: 2e18,
            feeAmount: 9e18,
            walletAddr: "2",
            dualAuthAddr: "2",
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      const callData = await exchangeTestUtil.deserializeRing(ringsInfo);
      const tx = await deserializerTest.deserialize(callData);
      pjs.logInfo("\x1b[46m%s\x1b[0m", "gas used: " + tx.receipt.gasUsed);
      showCallDataStats(callData);
    });

    it("single 3-size ring, wallet shared", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            index: 0,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 100e18,
            amountB: 10e18,
            feeAmount: 7e18,
            walletAddr: "0",
            dualAuthAddr: "0",
          },
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "LRC",
            amountS: 5e18,
            amountB: 45e18,
            feeAmount: 8e18,
            walletAddr: "0",
            dualAuthAddr: "1",
          },
          {
            index: 2,
            tokenS: "LRC",
            tokenB: "WETH",
            amountS: 3e18,
            amountB: 2e18,
            feeAmount: 9e18,
            walletAddr: "0",
            dualAuthAddr: "2",
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      const callData = await exchangeTestUtil.deserializeRing(ringsInfo);
      const tx = await deserializerTest.deserialize(callData);
      pjs.logInfo("\x1b[46m%s\x1b[0m", "gas used: " + tx.receipt.gasUsed);
      showCallDataStats(callData);
    });

    it("single 3-size ring, dual author shared", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            index: 0,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 100e18,
            amountB: 10e18,
            feeAmount: 7e18,
            walletAddr: "0",
            dualAuthAddr: "0",
          },
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "LRC",
            amountS: 5e18,
            amountB: 45e18,
            feeAmount: 8e18,
            walletAddr: "1",
            dualAuthAddr: "0",
          },
          {
            index: 2,
            tokenS: "LRC",
            tokenB: "WETH",
            amountS: 3e18,
            amountB: 2e18,
            feeAmount: 9e18,
            walletAddr: "2",
            dualAuthAddr: "0",
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      const callData = await exchangeTestUtil.deserializeRing(ringsInfo);
      const tx = await deserializerTest.deserialize(callData);
      pjs.logInfo("\x1b[46m%s\x1b[0m", "gas used: " + tx.receipt.gasUsed);
      showCallDataStats(callData);
    });

    it("order filled by 3 other orders", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1], [0, 2], [0, 3]],
        orders: [
          {
            index: 0,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 150e18,
            amountB: 15e18,
            feeAmount: 1e18,
            walletAddr: "0",
            dualAuthAddr: "0",
          },
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 5e18,
            amountB: 50e18,
            feeAmount: 2e18,
            walletAddr: "1",
            dualAuthAddr: "1",
          },
          {
            index: 2,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 5e18,
            amountB: 50e18,
            feeAmount: 2e18,
            walletAddr: "2",
            dualAuthAddr: "2",
          },
          {
            index: 3,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 5e18,
            amountB: 50e18,
            feeAmount: 2e18,
            walletAddr: "3",
            dualAuthAddr: "3",
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      const callData = await exchangeTestUtil.deserializeRing(ringsInfo);
      const tx = await deserializerTest.deserialize(callData);
      pjs.logInfo("\x1b[46m%s\x1b[0m", "gas used: " + tx.receipt.gasUsed);
      showCallDataStats(callData);
    });

  });

  it("single 2-size ring, pass by arrays", async () => {
    const uint16Data: number[] = []; // max: 6 * 2
    const uintData: number[] = []; // max: 10 * 2
    const addresses: string[] = []; // max: 11 * 2 + 3

    for (let i = 0; i < 12; i ++) {
      uint16Data.push(1);
    }

    for (let i = 0; i < 20; i ++) {
      uintData.push(1e18);
    }

    for (let i = 0; i < 25; i ++) {
      addresses.push(accounts[0]);
    }

    const tx = await deserializerTest.submitByArrays(uint16Data, uintData, addresses, 2);
    pjs.logInfo("\x1b[46m%s\x1b[0m", "gas used: " + tx.receipt.gasUsed);
  });

});
