import { expect } from "./setup";
import { MetaTx, signRecover, signMetaTx } from "./helper/signatureUtils";
import {
  newWallet,
  getFirstEvent,
  advanceTime,
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
  let metaTxInterface: any;

  before(async () => {
    [account1, account2, account3] = await ethers.getSigners();
    const GuardianLib = await ethers.getContractFactory("GuardianLib");
    const RecoverLib = await ethers.getContractFactory("RecoverLib", {
      libraries: {
        GuardianLib: ethers.constants.AddressZero
      }
    });
    const MetaTxLib = await ethers.getContractFactory("MetaTxLib", {
      libraries: {
        ERC20Lib: ethers.constants.AddressZero
      }
    });

    recoverInterface = RecoverLib.interface;
    guardianInterface = GuardianLib.interface;
    metaTxInterface = MetaTxLib.interface;
  });

  describe("MetaTx", () => {
    it("recover", async () => {
      const owner = await account1.getAddress();
      const newOwner = await account2.getAddress();
      const validUntil = 9999999999;
      const guardian1 = ethers.Wallet.createRandom();
      const guardian2 = ethers.Wallet.createRandom();

      const wallet = (await newWallet(owner, ethers.constants.AddressZero, 0, [
        guardian1.address,
        guardian2.address
      ])).connect(account3);
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

      const data = wallet.interface.encodeFunctionData(
        "recover",
        [approval, newOwner, newGuardians]
      );

      const metaTx: MetaTx = {
        sender: await account3.getAddress(),
        to: wallet.address,
        nonce: new BN(0),
        gasToken: ethers.constants.AddressZero,
        gasPrice: new BN(0),
        gasLimit: new BN(0),
        gasOverhead: new BN(0),
        requiresSuccess: true,
        data: Buffer.from(data.slice(2), "hex"),
        signature: Buffer.from("")
      };
      const metaTxSig = signMetaTx(masterCopy, metaTx, owner);

      const tx = await wallet.executeMetaTx(
        metaTx.to,
        metaTx.nonce.toString(10),
        metaTx.gasToken,
        metaTx.gasPrice.toString(10),
        metaTx.gasLimit.toString(10),
        metaTx.gasOverhead.toString(10),
        metaTx.requiresSuccess,
        metaTx.data,
        Buffer.from(metaTxSig.txSignature.slice(2), "hex")
      );
      const receipt = await tx.wait();
      // console.log("receipt:", receipt);
      const metaTxEvent = metaTxInterface.decodeEventLog(
        "MetaTxExecuted(address,bytes32,bool,uint256)",
        receipt.events[0].data,
        receipt.events[0].topics
      );

      // console.log("metaTxEvent:", metaTxEvent);

    });
  });
});
