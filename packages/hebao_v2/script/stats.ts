const hre = require("hardhat");
const ethers = hre.ethers;
import { attachWallet, getAllEvents } from "../test/commons";
import BN = require("bn.js");

async function getWalletCreatedEvents(walletFactory: string) {}

async function getTxStats(txHash: string) {}

async function gasStats() {
  const walletFactoryAddr = "0xf9185d2cA14Bb01CB78Ca6686FdFCde2c17E1aBb";
}

async function main() {}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
