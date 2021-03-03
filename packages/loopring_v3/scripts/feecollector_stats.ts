import * as fs from "fs";
import { newWeb3WithPrivateKey, infuraUrlMain } from "@freemanz/ts-utils";
const assert = require("assert");
const axios = require("axios").default;

// console.log("infuraUrlMain:", infuraUrlMain);
const gethUrl = "http://3.12.137.45:8545";
const web3 = newWeb3WithPrivateKey("0x" + "11".repeat(32), gethUrl);

const lrcAddr = "0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD";
const usdtAddr = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const usdcAddr = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const daiAddr = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
4;
const feeCollectorAddr = "0xeE94cf48924B720AF939E732E98F30F9594f87C5";

const blocksPerDay = 6500;
const lrcPrice = 0.54;
const ethPrice = 1518;

function formatDate(date: number) {
  var d = new Date(date),
    month = "" + (d.getMonth() + 1),
    day = "" + d.getDate(),
    year = d.getFullYear();

  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;

  return [year, month, day].join("-");
}

async function getFeeCollectorStatsViaEtherscan() {
  const tokenTxsData = await axios.get(
    "https://api-cn.etherscan.com/api?module=account&action=tokentx&address=0xeE94cf48924B720AF939E732E98F30F9594f87C5&startblock=11947418&endblock=11957918&sort=desc&apikey=1F73WEV5ZM2HKPIVCG65U5QQ427NPUG9FI"
  );
  console.log("tokenTxsData:", tokenTxsData.data.result);
}

async function getFeeCollectorStats() {
  const blockNumber = await web3.eth.getBlockNumber();
  console.log("current block number:", blockNumber);
  const currMillis = new Date().getTime();
  let currDate = formatDate(currMillis);
  let stats = await getFeeCollectorStatsOfDate(currDate, blockNumber);

  const res: any[] = [];
  for (let i = 1; i <= 7; i++) {
    const lastDate = formatDate(currMillis - 3600 * 24000 * i);
    const lastStats = await getFeeCollectorStatsOfDate(
      lastDate,
      blockNumber - i * blocksPerDay
    );
    const diff = {
      ethBalance: stats.ethBalance - lastStats.ethBalance,
      lrcBalance: stats.lrcBalance - lastStats.lrcBalance,
      usdtBalance: stats.usdtBalance - lastStats.usdtBalance,
      usdcBalance: stats.usdcBalance - lastStats.usdcBalance,
      daiBalance: stats.daiBalance - lastStats.daiBalance
    };
    console.log("diff:", diff);

    const usdValue =
      diff.ethBalance * ethPrice +
      diff.lrcBalance * lrcPrice +
      diff.usdtBalance +
      diff.usdcBalance +
      diff.daiBalance;

    res.push({ date: stats.date, usdValue });
  }

  console.log("res:", res);
}

async function getFeeCollectorStatsOfDate(date: string, blockNumber: number) {
  console.log("get feeCollector stats ot block:", blockNumber);

  const lrcBalance = await getTokenBalanceAtBlock(lrcAddr, blockNumber);
  const usdtBalance = await getTokenBalanceAtBlock(usdtAddr, blockNumber);
  const usdcBalance = await getTokenBalanceAtBlock(usdcAddr, blockNumber);
  const daiBalance = await getTokenBalanceAtBlock(daiAddr, blockNumber);
  const ethBalance = Number(
    await web3.eth.getBalance(feeCollectorAddr, blockNumber)
  );

  return { date, ethBalance, lrcBalance, usdtBalance, usdcBalance, daiBalance };
}

async function getTokenBalanceAtBlock(token: string, blockNumber: number) {
  const tokenContract = new web3.eth.Contract(
    JSON.parse(fs.readFileSync("ABI/version36/ERC20.abi", "ascii")),
    token
  );

  const balance = await tokenContract.methods
    .balanceOf(feeCollectorAddr)
    .call(undefined, blockNumber);
  console.log("balance:", balance);
  return Number(balance);
}

async function main() {
  await getFeeCollectorStatsViaEtherscan();
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
