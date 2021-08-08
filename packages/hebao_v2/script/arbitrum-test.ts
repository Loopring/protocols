const hre = require("hardhat");
const ethers = hre.ethers;
import BN = require("bn.js");
import {
  newWallet,
  getFirstEvent,
  getBlockTimestamp,
  sortSignersAndSignatures
} from "../test/commons";
import { MetaTx, signMetaTx } from "../test/helper/signatureUtils";

async function main() {
  // deploy factory and wallet:
  const ownerAccount = (await ethers.getSigners())[0];
  const owner = await ownerAccount.getAddress();

  // send metaTx:
  const wallet = await newWallet(owner, ethers.constants.AddressZero, 0);
  const masterCopy = await wallet.getMasterCopy();

  const transferTo = "0x" + "11".repeat(20);
  // transfer ETH:
  const data = wallet.interface.encodeFunctionData("transferToken", [
    ethers.constants.AddressZero,
    transferTo,
    ethers.utils.parseEther("0"),
    [],
    false
  ]);

  const feeRecipient = "0x" + "22".repeat(20);
  const metaTx: MetaTx = {
    to: wallet.address,
    nonce: new BN(new Date().getTime()),
    gasToken: ethers.constants.AddressZero,
    gasPrice: new BN(0),
    gasLimit: new BN(1000000),
    gasOverhead: new BN(0),
    feeRecipient,
    requiresSuccess: true,
    data: Buffer.from(data.slice(2), "hex"),
    signature: Buffer.from(""),
    approvedHash: Buffer.from("00".repeat(32), "hex")
  };
  const metaTxSig = signMetaTx(masterCopy, metaTx, owner);

  const tx = await wallet.executeMetaTx(
    metaTx.to,
    metaTx.nonce.toString(10),
    metaTx.gasToken,
    metaTx.gasPrice.toString(10),
    metaTx.gasLimit.toString(10),
    metaTx.gasOverhead.toString(10),
    metaTx.feeRecipient,
    metaTx.requiresSuccess,
    metaTx.data,
    Buffer.from(metaTxSig.txSignature.slice(2), "hex")
  );

  // check gasUsed:
  const receipt = await tx.wait();
  console.log("receipt:", receipt);

  const logGasEvent = await getFirstEvent(wallet, tx.blockNumber, "LogGas");
  const metaTxExecuted = await getFirstEvent(
    wallet,
    tx.blockNumber,
    "MetaTxExecuted"
  );
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
