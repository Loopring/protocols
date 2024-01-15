const hre = require("hardhat");
const ethers = hre.ethers;
const fs = require("fs");
import { attachWallet } from "../test/commons";
import BN = require("bn.js");
import { decodeMetaTx } from "./parse-data";

const txHashsFile = "./script/data/metatx-hashs.json";
const gasStatsFile = "./script/data/gas-stats.json";

async function fetchAllMetaTxHashs() {
  if (fs.existsSync(txHashsFile)) {
    console.log("load hashes from cache file");
    return new Set(JSON.parse(fs.readFileSync(txHashsFile, "ascii")));
  }

  console.log("fetch tx hashes from arbitrum chain");
  // operators:
  // 0x32C03aD6a42b8572bB2c317076ee48f904A580c4
  // 0xB259D7F2042b168c60FD5593d1a84327581dd89E
  // 0xA5b2DA9ddfCc4E554bB255D9989fdD7be3858Bc9
  const walletAddrs = [
    "0x11f694a16a0abea4d3cdc3b909db09bca68a2f31",
    "0xc238c9f6e0d73f7e16632430bc0af758c9c5184d",
    "0xcea2f215d122e7e43615789ad7c80128c82b3742",
    "0xd5535729714618e57c42a072b8d56e72517f3800",
    "0xacba35c89046f6083bbd6bf6d6e88b438c9b1a1b",
  ];

  // get all transactions within 3 days:
  const fromBlock = 1350000; // 2021-07-30
  const metaTxHashs: Set<string> = new Set();

  for (const walletAddr of walletAddrs) {
    const metatxContract = await (
      await ethers.getContractFactory("MetaTxLib", {
        libraries: {
          ERC20Lib: ethers.constants.AddressZero,
        },
      })
    ).attach(walletAddr);

    const events = await metatxContract.queryFilter(
      metatxContract.filters.MetaTxExecuted,
      fromBlock
    );
    // console.log("events:", events);
    events.forEach((e) => {
      metaTxHashs.add(e.transactionHash);
    });
  }

  console.log("metaTxHashs:", metaTxHashs);
  fs.writeFileSync(txHashsFile, JSON.stringify([...metaTxHashs], undefined, 2));
  return metaTxHashs;
}

async function gasStats() {
  const hashs = await fetchAllMetaTxHashs();
  console.log("hashs:", hashs);

  const res: any[] = [];
  const validHashes: string[] = [];
  for (const txHash of [...hashs]) {
    console.log("process tx:", txHash);

    const transaction = await ethers.provider.getTransaction(txHash);
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    try {
      const innerTx = await decodeMetaTx(transaction.data);
      console.log("innerTx:", innerTx);
      validHashes.push(txHash);
      res.push({
        txHash,
        gasUsed: receipt.gasUsed.toString(),
        txType: innerTx.name,
      });
    } catch (err) {
      console.error(err);
    }
  }

  fs.writeFileSync(txHashsFile, JSON.stringify(validHashes, undefined, 2));
  fs.writeFileSync(gasStatsFile, JSON.stringify(res, undefined, 2));
}

async function main() {
  await gasStats();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
