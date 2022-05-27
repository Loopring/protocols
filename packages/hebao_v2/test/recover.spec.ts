import { expect } from "./setup";
import { signRecover } from "./helper/signatureUtils";
import { sign } from "./helper/Signature";
import {
  newWallet,
  getFirstEvent,
  getBlockTimestamp,
  sortSignersAndSignatures
} from "./commons";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("wallet", () => {
  let account1: Signer;
  let account2: Signer;
  let account3: Signer;
  let recoverInterface: any;
  let guardianInterface: any;

  before(async () => {
    [account1, account2, account3] = await ethers.getSigners();
    const GuardianLib = await ethers.getContractFactory("GuardianLib");
    const RecoverLib = await ethers.getContractFactory("RecoverLib", {
      libraries: {
        GuardianLib: ethers.constants.AddressZero
      }
    });
    recoverInterface = RecoverLib.interface;
    guardianInterface = GuardianLib.interface;
  });

  describe("recover", () => {
    it("majority guardians should be able to recover a wallet", async () => {
      const owner = await account1.getAddress();
      const newOwner = await account2.getAddress();
      const validUntil = 9999999999;
      const guardian1 = ethers.Wallet.createRandom();
      const guardian2 = ethers.Wallet.createRandom();

      const wallet = await newWallet(owner, ethers.constants.AddressZero, 0, [
        guardian1.address,
        guardian2.address
      ]);
      const masterCopy = await wallet.getMasterCopy();

      // console.log("guardian1.privateKey:", guardian1.privateKey);

      const sig1 = signRecover(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        newOwner,
        [],
        guardian1.address,
        guardian1.privateKey.slice(2)
      );
      const sig1Bs = Buffer.from(sig1.txSignature.slice(2), "hex");

      const sig2 = signRecover(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        newOwner,
        [],
        guardian2.address,
        guardian2.privateKey.slice(2)
      );
      const sig2Bs = Buffer.from(sig2.txSignature.slice(2), "hex");

      const sortedSigs = sortSignersAndSignatures(
        [guardian1.address, guardian2.address],
        [sig1Bs, sig2Bs]
      );

      const approval = {
        signers: sortedSigs.sortedSigners,
        signatures: sortedSigs.sortedSignatures,
        validUntil,
        wallet: wallet.address
      };

      const tx = await wallet.recover(approval, newOwner, []);
      // console.log("tx:", tx);
      const receipt = await tx.wait();
      const recoverEventData = receipt.events[1].data;
      const recoverEventTopics = receipt.events[1].topics;
      const recoverEvent = recoverInterface.decodeEventLog(
        "Recovered(address)",
        recoverEventData,
        recoverEventTopics
      );
      // console.log("recoverEvent:", recoverEvent);
      expect(recoverEvent.newOwner).to.equal(newOwner);

      const newOwnerInContract = (await wallet.wallet()).owner;
      expect(newOwnerInContract).to.equal(newOwner);
    });

    it("[hebaov2.1] signatures without signature type should be able to be verified", async () => {
      const owner = await account1.getAddress();
      const newOwner = await account2.getAddress();
      const validUntil = 9999999999;
      const guardian1 = ethers.Wallet.createRandom();
      const guardian2 = ethers.Wallet.createRandom();

      const wallet = await newWallet(owner, ethers.constants.AddressZero, 0, [
        guardian1.address,
        guardian2.address
      ]);
      const masterCopy = await wallet.getMasterCopy();

      // console.log("guardian1.privateKey:", guardian1.privateKey);

      const sig1 = signRecover(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        newOwner,
        [],
        guardian1.address,
        guardian1.privateKey.slice(2)
      );
      const sig1Bs = Buffer.from(sig1.txSignature.slice(2), "hex");

      const sig2 = signRecover(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        newOwner,
        [],
        guardian2.address,
        guardian2.privateKey.slice(2)
      );
      const sig2Bs = Buffer.from(sig2.txSignature.slice(2), "hex");

      const sig1BsWithoutType = sig1Bs.slice(0, sig1Bs.length - 1);
      const sig2BsWithoutType = sig2Bs.slice(0, sig2Bs.length - 1);
      const sortedSigs = sortSignersAndSignatures(
        [guardian1.address, guardian2.address],
        [sig1BsWithoutType, sig2BsWithoutType]
      );

      const approval = {
        signers: sortedSigs.sortedSigners,
        signatures: sortedSigs.sortedSignatures,
        validUntil,
        wallet: wallet.address
      };

      const tx = await wallet.recover(approval, newOwner, []);
      // console.log("tx:", tx);
      const receipt = await tx.wait();
      const recoverEventData = receipt.events[1].data;
      const recoverEventTopics = receipt.events[1].topics;
      const recoverEvent = recoverInterface.decodeEventLog(
        "Recovered(address)",
        recoverEventData,
        recoverEventTopics
      );
      // console.log("recoverEvent:", recoverEvent);
      expect(recoverEvent.newOwner).to.equal(newOwner);

      const newOwnerInContract = (await wallet.wallet()).owner;
      expect(newOwnerInContract).to.equal(newOwner);
    });

    it("should be able to reset guardians when recovering a wallet", async () => {
      const owner = await account1.getAddress();
      const newOwner = await account2.getAddress();
      const validUntil = 9999999999;
      const guardian1 = ethers.Wallet.createRandom();
      const guardian2 = ethers.Wallet.createRandom();

      const wallet = await newWallet(owner, ethers.constants.AddressZero, 0, [
        guardian1.address,
        guardian2.address
      ]);
      const masterCopy = await wallet.getMasterCopy();

      // console.log("guardian1.privateKey:", guardian1.privateKey);
      const newGuardians = ["0x" + "11".repeat(20), "0x" + "22".repeat(20)];
      const sig1 = signRecover(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        newOwner,
        newGuardians,
        guardian1.address,
        guardian1.privateKey.slice(2)
      );
      const sig1Bs = Buffer.from(sig1.txSignature.slice(2), "hex");

      const sig2 = signRecover(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        newOwner,
        newGuardians,
        guardian2.address,
        guardian2.privateKey.slice(2)
      );
      const sig2Bs = Buffer.from(sig2.txSignature.slice(2), "hex");

      const sortedSigs = sortSignersAndSignatures(
        [guardian1.address, guardian2.address],
        [sig1Bs, sig2Bs]
      );

      const approval = {
        signers: sortedSigs.sortedSigners,
        signatures: sortedSigs.sortedSignatures,
        validUntil,
        wallet: wallet.address
      };

      const tx = await wallet.recover(approval, newOwner, newGuardians);
      const receipt = await tx.wait();
      // console.log("receipt:", receipt);
      const addEvent1 = guardianInterface.decodeEventLog(
        "GuardianAdded(address,uint256)",
        receipt.events[1].data,
        receipt.events[1].topics
      );
      expect(addEvent1.guardian).to.equal(newGuardians[0]);

      const addEvent2 = guardianInterface.decodeEventLog(
        "GuardianAdded(address,uint256)",
        receipt.events[2].data,
        receipt.events[2].topics
      );
      expect(addEvent2.guardian).to.equal(newGuardians[1]);
    });

    it("recover with duplicated guardians", async () => {
      const owner = await account1.getAddress();
      const newOwner = await account2.getAddress();
      const validUntil = 9999999999;
      const guardian1 = ethers.Wallet.createRandom();
      const guardian2 = ethers.Wallet.createRandom();

      const wallet = await newWallet(owner, ethers.constants.AddressZero, 0, [
        guardian1.address,
        guardian2.address
      ]);
      const masterCopy = await wallet.getMasterCopy();

      // console.log("guardian1.privateKey:", guardian1.privateKey);
      const newGuardians = [
        "0x" + "11".repeat(20),
        "0x" + "11".repeat(20),
        "0x" + "11".repeat(20)
      ];
      const sig1 = signRecover(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        newOwner,
        newGuardians,
        guardian1.address,
        guardian1.privateKey.slice(2)
      );
      const sig1Bs = Buffer.from(sig1.txSignature.slice(2), "hex");

      const sig2 = signRecover(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        newOwner,
        newGuardians,
        guardian2.address,
        guardian2.privateKey.slice(2)
      );
      const sig2Bs = Buffer.from(sig2.txSignature.slice(2), "hex");

      const sortedSigs = sortSignersAndSignatures(
        [guardian1.address, guardian2.address],
        [sig1Bs, sig2Bs]
      );

      const approval = {
        signers: sortedSigs.sortedSigners,
        signatures: sortedSigs.sortedSignatures,
        validUntil,
        wallet: wallet.address
      };

      try {
        const tx = await wallet.recover(approval, newOwner, newGuardians);
      } catch (err) {
        // console.log(err.message);
        expect(err.message.includes("INVALID_ORDERING"));
      }
    });
  });
});
