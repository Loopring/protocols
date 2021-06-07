import { expect } from "./setup";
const { ethers } = require("hardhat");
import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe.only("gas comparision", () => {
  let account1: Signer;

  describe("mapping data", () => {
    it("add test, 1 to 7", async () => {
      [account1] = await ethers.getSigners();
      const owner = await account1.getAddress();
      const impl1 = await (await ethers.getContractFactory("Impl1")).deploy();

      for(let i = 1; i <= 7; i++) {
        const newGuardian = "0x" + (i + "").repeat(40);
        const tx = await impl1.addGuardian(newGuardian);
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed.toString();
        console.log("i:", i, "; gasUsed:", gasUsed);
      }
    });
  });

  describe("bytes32 hash", () => {
    it("add test, 1 to 7", async () => {
      [account1] = await ethers.getSigners();
      const owner = await account1.getAddress();
      const impl2 = await (await ethers.getContractFactory("Impl2")).deploy();

      const guardians: string[] = [];
      for(let i = 1; i <= 7; i++) {
        const newGuardian = "0x" + (i + "").repeat(40);
        const tx = await impl2.addGuardian(guardians, newGuardian);
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed.toString();
        console.log("i:", i, "; gasUsed:", gasUsed);
        guardians.push(newGuardian);
      }
    });
  });

});
