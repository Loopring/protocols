import { expect } from "./setup";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("proxy", () => {
  before(async () => {});

  describe("fallback call", () => {
    it("proxy revert when proxy call returns 0", async () => {
      const factory = await (await ethers.getContractFactory(
        "TestUniswapV2Factory"
      )).deploy();
      const wethAddr = "0x" + "01".repeat(20);
      const uniswapV2PriceOracle = await (await ethers.getContractFactory(
        "UniswapV2PriceOracle"
      )).deploy(factory.address, wethAddr);
      const priceOracleDelegate = await (await ethers.getContractFactory(
        "PriceOracleDelegate"
      )).deploy(uniswapV2PriceOracle.address);

      const proxy = await (await ethers.getContractFactory(
        "OwnedUpgradeabilityProxy"
      )).deploy();
      const proxyPriceOracle = await (await ethers.getContractFactory(
        "UniswapV2PriceOracle"
      )).attach(proxy.address);

      await proxy.upgradeTo(uniswapV2PriceOracle.address);
      try {
        const tokenValue2 = await proxyPriceOracle.tokenValue(
          "0x" + "11".repeat(20),
          1000
        );
          // console.log("tokenValue2:", tokenValue2.toString());
      } catch (err) {
          // console.log("err:", err);
        expect(err.message.includes("revert"));
      }

      await proxy.upgradeTo(priceOracleDelegate.address);
      const proxyDelegateOracle = await (await ethers.getContractFactory(
        "PriceOracleDelegate"
      )).attach(proxy.address);
      const tokenValue3 = await proxyDelegateOracle.tokenValue(
        "0x" + "11".repeat(20),
        1000
      );
	// console.log("tokenValue3:", tokenValue3.toString());
    });
  });
});
