import * as fs from "fs";
import { newWeb3WithPrivateKey, infuraUrlMain, Eth } from "@freemanz/ts-utils";
const assert = require("assert");
const web3 = newWeb3WithPrivateKey("0x" + "11".repeat(32), infuraUrlMain);
const myEth = new Eth(web3, false);

const exchangeAddress = "0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4";
const tokenCount = 200;
const tokenFile = ".tmp.token-list.json";
const resFile = ".tmp.token-gas-stats.json";

async function getAllTokensInLoopring() {
  console.log("fetching token info from Loopring Exchange...");
  const res = new Map();

  await Promise.all(
    [...Array(tokenCount).keys()].map(async function(i) {
      if (i == 0) return;
      const tokenAddress = await myEth.call(
        "ABI/version36/IExchangeV3.abi",
        exchangeAddress,
        "getTokenAddress",
        i
      );

      console.log(i, tokenAddress);
      res.set(i, tokenAddress);
    })
  );

  fs.writeFileSync(tokenFile, JSON.stringify([...res], undefined, 2));
  console.log("fetch token info finished.");
  return res;
}

async function loadTokens() {
  if (fs.existsSync(tokenFile)) {
    const res = new Map(JSON.parse(fs.readFileSync(tokenFile, "ascii")));
    return res;
  } else {
    return await getAllTokensInLoopring();
  }
}

async function loadRes() {
  if (fs.existsSync(resFile)) {
    const res = JSON.parse(fs.readFileSync(resFile, "ascii"));
    return res;
  } else {
    return [];
  }
}

function resContains(res: any[], token: string) {
  for (const item of res) {
    if (item && item.token === token) return true;
  }
  return false;
}

async function fetchAllTokenGasStats() {
  const tokenMap = await loadTokens();
  const res: any[] = await loadRes();

  // await Promise.all(
  //   [...tokenMap.values()].map(async function(token) {
  //     const gasStats = await fetchTokenGasStats(token);
  //     res.push(gasStats);
  //   })
  // );

  for (const token of tokenMap.values()) {
    if (resContains(res, token)) {
      console.log("token stats already fetched, skip.", token);
      continue;
    }
    const gasStats = await fetchTokenGasStats(token);
    res.push(gasStats);
    fs.writeFileSync(resFile, JSON.stringify(res, undefined, 2));
  }

  console.log("gas stats res:", res);
  fs.writeFileSync(resFile, JSON.stringify(res, undefined, 2));
}

async function fetchTokenGasStats(token: string) {
  console.log("fetch stats for token:", token);

  const symbol = await myEth.call(
    "ABI/version36/ERC20Token.abi",
    token,
    "symbol"
  );
  console.log("symbol:", symbol);
  if (symbol.startsWith("LP-")) return;

  const transferEvents = await myEth.getEvents(
    "ABI/version36/ERC20Token.abi",
    token,
    "Transfer",
    100000
  );
  console.log("transferEvents len:", transferEvents.length);

  const txhashs = transferEvents.map(e => e.transactionHash);
  const gasUsedArr: number[] = [];
  let sum = 0;

  const _stats = await Promise.all(
    txhashs.map(async function(hash) {
      const tx = await web3.eth.getTransaction(hash);
      const receipt = await web3.eth.getTransactionReceipt(hash);

      if (
        receipt.to === token.toLowerCase() &&
        tx.input.startsWith("0xa9059cbb")
      ) {
        const gasUsed = Number(receipt.gasUsed);
        gasUsedArr.push(gasUsed);
        sum += gasUsed;
      } else {
        console.log("not transfer tx, skip.");
        return;
      }
    })
  );

  console.log("gasUsedArr len:", gasUsedArr.length);

  const gasStats = {
    symbol,
    token,
    max: Math.max(...gasUsedArr),
    avg: Math.floor(sum / gasUsedArr.length)
  };

  console.log("gasStats:", gasStats);

  return gasStats;
}

async function main() {
  await fetchAllTokenGasStats();
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
