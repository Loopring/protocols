import { expect } from "./setup";

import { ethers } from 'hardhat'
// import { l2ethers as ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("wallet lock", () => {
  let account1: Signer;
  let account2: Signer;
  let account3: Signer;
  before(async () => {
    [account1, account2, account3] = await ethers.getSigners();
  });

  const name = "Some Really Cool Token Name";
  const initialSupply = 10000000;

  let TestPriceOracle: Contract;
  let SmartWallet: Contract;
  let WalletFactory: Contract;
  beforeEach(async () => {
    TestPriceOracle = await (await ethers.getContractFactory("TestPriceOracle"))
      .connect(account1)
      .deploy();

    SmartWallet = await (await ethers.getContractFactory("SmartWallet"))
      .connect(account1)
      .deploy(TestPriceOracle.address);

    WalletFactory = await (await ethers.getContractFactory("WalletFactory"))
      .connect(account1)
      .deploy(SmartWallet.address);
  });

  describe("the basics", () => {
    it("should have a name", async () => {});
  });
});
