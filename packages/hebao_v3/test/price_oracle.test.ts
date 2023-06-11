import { ethers } from "hardhat";
import { expect } from "chai";
import { fixture } from "./helper/fixture";
import _ from "lodash";
import { arrayify } from "ethers/lib/utils";
import {
  loadFixture,
  setBalance,
  time,
  takeSnapshot,
} from "@nomicfoundation/hardhat-network-helpers";
import {
  GuardianLib__factory,
  SmartWalletV3__factory,
} from "../typechain-types";
import { getBlockTimestamp, createSmartWallet } from "./helper/utils";
import { fillUserOp, fillAndMultiSign, getUserOpHash } from "./helper/AASigner";
import BN from "bn.js";

describe("price oracle test", () => {
  // describe('', ()=>{
  // })

  it("uniswapv2 price oracle test", async () => {
    // const uniswapv2  = await (await ethers.getContractFactory('UniswapV2PriceOracle')).deploy(uniswapv2, wethToken);
  });

  it("kyber price oracle test", async () => {});
});
