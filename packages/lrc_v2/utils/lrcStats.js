const _ = require("lodash");
const Promise = require("bluebird");
const async = require("async");
const fs = require("fs");
const assert = require('assert');
const lineReader = require("line-reader");
const BigNumber = require("bignumber.js");

const Web3 = require("web3");
// const web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/hM4sFGiBdqbnGTxk5YT2"));
const web3 = new Web3(new Web3.providers.HttpProvider("http://13.231.203.81:8545"));

const lrcAbi = '[{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"bonusPercentages","outputs":[{"name":"","type":"uint8"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"DECIMALS","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"BLOCKS_PER_PHASE","outputs":[{"name":"","type":"uint16"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"MAX_UNSOLD_RATIO","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"HARD_CAP","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"BASE_RATE","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[],"name":"close","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"saleStarted","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"issueIndex","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"recipient","type":"address"}],"name":"issueToken","outputs":[],"payable":true,"type":"function"},{"constant":false,"inputs":[{"name":"_firstblock","type":"uint256"}],"name":"start","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"hardCapReached","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"saleEnded","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"unsoldTokenIssued","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"price","outputs":[{"name":"tokens","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"GOAL","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"NAME","outputs":[{"name":"","type":"string"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"totalEthReceived","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"saleDue","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"target","outputs":[{"name":"","type":"address"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"NUM_OF_PHASE","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"remaining","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"firstblock","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"SYMBOL","outputs":[{"name":"","type":"string"}],"payable":false,"type":"function"},{"inputs":[{"name":"_target","type":"address"}],"payable":false,"type":"constructor"},{"payable":true,"type":"fallback"},{"anonymous":false,"inputs":[],"name":"SaleStarted","type":"event"},{"anonymous":false,"inputs":[],"name":"SaleEnded","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"caller","type":"address"}],"name":"InvalidCaller","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"msg","type":"bytes"}],"name":"InvalidState","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"issueIndex","type":"uint256"},{"indexed":false,"name":"addr","type":"address"},{"indexed":false,"name":"ethAmount","type":"uint256"},{"indexed":false,"name":"tokenAmount","type":"uint256"}],"name":"Issue","type":"event"},{"anonymous":false,"inputs":[],"name":"SaleSucceeded","type":"event"},{"anonymous":false,"inputs":[],"name":"SaleFailed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"}]'; // tslint:disable-line

const lrcAddr = "0xef68e7c694f40c8202821edf525de3782458639f";
const lrcToken = new web3.eth.Contract(JSON.parse(lrcAbi), lrcAddr);

const startBlock = 7714800;
const destBlock  = 7715000;

const eachLine = Promise.promisify(lineReader.eachLine);

async function parseAllHoldersFromIssueEvents() {
  const issueStartBlock = 4100000;
  const issueEndBlock = 5100000;
  const holders = new Set();
  const events = await lrcToken.getPastEvents(
    "Issue",
    {
      fromBlock: issueStartBlock,
      toBlock: issueEndBlock
    }
  );
  console.log("Issue events size:", events.length);

  events.forEach( e => {
    holders.add(e.returnValues.addr.toLowerCase());
  });

  return holders;
}

async function parseAllHoldersFromEvents() {
  const allHolders = new Set();

  const getHoldersInBlocks = async (fromBlock, toBlock) => {
    console.log("get events between block:", fromBlock, toBlock);

    const holders = new Set();
    const events = await lrcToken.getPastEvents(
      "Transfer",
      {
        fromBlock: fromBlock,
        toBlock: toBlock
      }
    );

    console.log("events size:", events.length);

    events.forEach( e => {
      holders.add(e.returnValues.from.toLowerCase());
      holders.add(e.returnValues.to.toLowerCase());
    });

    return holders;
  };

  const tryAndRedo = async (from, to, step) => {
    const retryRanges = [];
    for (let i = from; i < to; i += step) {
      let end = i + step;
      if (end > to) {
        end = to;
      }
      try {
        const holdersInBlocks = await getHoldersInBlocks(i, end);
        holdersInBlocks.forEach(h => allHolders.add(h));
      } catch (err) {
        retryRanges.push([i, end]);
      }
    }
    // console.log("retryRanges:", retryRanges);
    return retryRanges;
  };

  const skipedRanges10k = await tryAndRedo(startBlock, destBlock, 10000);
  console.log("skipedRanges10k:", skipedRanges10k);

  let skipedRanges1k = [];
  for (const range10k of skipedRanges10k) {
    const fromBlock = range10k[0];
    const toBlock = range10k[1];
    const redoJobs =  await tryAndRedo(fromBlock, toBlock, 1000);
    skipedRanges1k = skipedRanges1k.concat(redoJobs);
  }
  console.log("skipedRanges1k:", skipedRanges1k);

  let skipedRanges100 = [];
  for (const range1k of skipedRanges1k) {
    const fromBlock = range1k[0];
    const toBlock = range1k[1];
    const redoJobs =  await tryAndRedo(fromBlock, toBlock, 100);
    skipedRanges100 = skipedRanges100.concat(redoJobs);
  }
  console.log("skipedRanges100:", skipedRanges100);

  let skipedRanges10 = [];
  for (const range100 of skipedRanges100) {
    const fromBlock = range100[0];
    const toBlock = range100[1];
    const redoJobs =  await tryAndRedo(fromBlock, toBlock, 10);
    skipedRanges10 = skipedRanges10.concat(redoJobs);
  }
  console.log("skipedRanges10:", skipedRanges10);
  assert(skipedRanges10.length == 0);

  return allHolders;
}

async function getAllHolders(allHoldersFile) {
  console.log("start block:", startBlock, "; destBlock:", destBlock);

  const allHolders = await parseAllHoldersFromEvents();
  console.log("allHolders size:", allHolders.size);
  const allIssueHolders = await parseAllHoldersFromIssueEvents();
  allIssueHolders.forEach(ih => allHolders.add(ih));
  console.log("allHolders size with issue holders:", allHolders.size);

  allHolders.forEach(h => fs.appendFileSync(allHoldersFile, h + "\n"));
}

async function getRecentHolders(allHoldersFile) {
  console.log("start block:", startBlock, "; destBlock:", destBlock);

  const allHolders = await parseAllHoldersFromEvents();
  console.log("allHolders size:", allHolders.size);
  allHolders.forEach(h => fs.appendFileSync(allHoldersFile, h + "\n"));
}

async function getBalanceOfHoldersPlain(addressesFile, destFile) {
  console.log("query balance:", addressesFile, "->", destFile);

  const allAddrs = [];
  await eachLine(addressesFile, async function(line) {
    const addr = line.trim();
    allAddrs.push(addr);
  });

  const batchSize = 1000;
  const requestAddrs = allAddrs.slice();
  // const from = "0x" + "00".repeat(20);
  for (let i = 0; i < requestAddrs.length; i += batchSize) {
    console.log("batch:", i);
    // const web3Temp = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/hM4sFGiBdqbnGTxk5YT2"));
    // const lrcTokenTemp = new web3Temp.eth.Contract(JSON.parse(lrcAbi), lrcAddr);
    let end = i + batchSize;
    if (end > requestAddrs.length) {
      end = requestAddrs.length;
    }

    for (let j = i; j < end; j++) {
      if (!requestAddrs[j]) {
        console.log("invalid address:", requestAddrs[j]);
        continue;
      }
      const balance = await lrcToken.methods.balanceOf(requestAddrs[j]).call({}, destBlock);
      const destLine = requestAddrs[j] + "," + balance.toString(10) + "\n";
      fs.appendFileSync(destFile, destLine);
    }

    // close web3js temp connection:
    // web3Temp.currentProvider.connection.close();
  }

}

async function getBalanceOfHolders(addressesFile, destFile) {
  console.log("query balance:", addressesFile, "->", destFile);

  const allAddrs = [];
  await eachLine(addressesFile, async function(line) {
    const addr = line.trim();
    allAddrs.push(addr);
  });

  const batchSize = 1000;
  const requestAddrs = allAddrs.slice();
  // const from = "0x" + "00".repeat(20);
  for (let i = 0; i < requestAddrs.length; i += batchSize) {
    console.log("batch:", i);
    const batch = new web3.BatchRequest();
    let end = i + batchSize;
    if (end > requestAddrs.length) {
      end = requestAddrs.length;
    }

    for (let j = i; j < end; j++) {
      if (!requestAddrs[j]) {
        console.log("invalid address:", requestAddrs[j]);
        continue;
      }

      batch.add(
        lrcToken.methods.balanceOf(requestAddrs[j]).call.request({}, (err, res) => {
          if (err) {
            console.log("error:", err, requestAddrs[j]);
          } else {
            const destLine = requestAddrs[j] + "," + res.toString(10) + "\n";
            fs.appendFileSync(destFile, destLine);
          }
        })
      );
    }

    await batch.execute();
  }

}

async function deduplicateAndSort(allBalanceFile, sortedBalanceFile) {
  const addrSet = new Set();
  const allBalances = [];
  await eachLine(allBalanceFile, function(line) {
    const kv = line.split(",");
    const addr = kv[0];
    const amountStr = kv[1];
    // const amountBN = new BigNumber(amountStr, 10);
    if (!addrSet.has(addr)) {
      allBalances.push([addr, amountStr]);
      addrSet.add(addr);
    }
  });

  const sortedBalances = allBalances.sort((a, b) => {
    const amountA = new BigNumber(a[1], 10);
    const amountB = new BigNumber(b[1], 10);
    if (amountA >= amountB) {
      return -1;
    } else {
      return 1;
    }
  });

  sortedBalances.forEach(b => fs.appendFileSync(sortedBalanceFile, b[0] + "," + b[1] + "\n"));
}

async function getTotalAmount(allBalanceFile) {
  console.log("balance file:", allBalanceFile);
  let totalAmount = new BigNumber("0", 10);
  const addrSet = new Set();
  await eachLine(allBalanceFile, function(line) {
    const kv = line.split(",");
    const addr = kv[0];
    if (addrSet.has(addr)) {
      console.log("ERROR: addr appears multiple times in result file:", addr);
    } else {
      addrSet.add(addr);
    }
    const amountStr = kv[1];
    totalAmount = totalAmount.plus(new BigNumber(amountStr, 10));
  });

  console.log("totalAmount:", totalAmount.toString(10));

  return totalAmount;
}

async function calcTotalAmountAndAssert(allBalanceFile) {
  const totalAmount = await getTotalAmount(allBalanceFile);
  // totalSupply: 1395076054523857892274603100
  assert(totalAmount.toString(10) === "1395076054523857892274603100");
  console.log("sumed total amount is equals to LRC's totalSupply!");
}

async function mergeFile(file1, file2, mergedFile) {
  console.log("merge holders files:", file1, file2, " => ", mergedFile);

  const mergedHolders = new Set();
  await eachLine(file1, function(line) {
    mergedHolders.add(line.trim());
  });

  await eachLine(file2, function(line) {
    mergedHolders.add(line.trim());
  });

  mergedHolders.forEach(h => fs.appendFileSync(mergedFile, h + "\n"));
}

async function updateBalanceInfo(historyBalanceFile, incrementalBalanceFile, allBalanceFile) {
  const balanceMap = new Map();

  await eachLine(historyBalanceFile, function(line) {
    const kv = line.trim().split(",");
    const addr = kv[0];
    const amountStr = kv[1];
    balanceMap.set(addr, amountStr);
  });

  await eachLine(incrementalBalanceFile, function(line) {
    const kv = line.trim().split(",");
    const addr = kv[0];
    const amountStr = kv[1];
    balanceMap.set(addr, amountStr);
  });

  balanceMap.forEach((v, k) => fs.appendFileSync(allBalanceFile, k + "," + v + "\n"));
}

async function compareBalanceFile(balanceFile1, balanceFile2) {
  console.log("compare balance files:", balanceFile1, balanceFile2);
  const balanceMap = new Map();

  await eachLine(balanceFile1, function(line) {
    const kv = line.trim().split(",");
    const addr = kv[0];
    const amountStr = kv[1];
    balanceMap.set(addr, amountStr);
  });

  await eachLine(balanceFile2, function(line) {
    const kv = line.trim().split(",");
    const addr = kv[0];
    const amountStr = kv[1];
    const amountStr1 = balanceMap.get(addr);
    assert(amountStr1 === amountStr);
  });

  console.log("balance files are identical!");
}

async function updateAllContractAddrs(contractBalanceFile, incrementalBalanceFile) {
  const isContract = async (addr) => {
    const code = await web3.eth.getCode(addr);
    if (code && code.length > 2) {
      return true;
    } else {
      return false;
    }
  };

  const contractHoldersSet = new Set();
  await eachLine(contractBalanceFile, function(line) {
    const kv = line.trim().split(",");
    const addr = kv[0];
    contractHoldersSet.add(addr);
  });

  await eachLine(incrementalBalanceFile, async function(line) {
    const kv = line.trim().split(",");
    const addr = kv[0];
    const amountStr = kv[1];
    const isContractAddr = await isContract(addr);
    if (isContractAddr) {
      console.log("found new contract address:", addr);
      contractHoldersSet.add(addr);
    }
  });

  return contractHoldersSet;
}

async function getPlainBalances(contractAddrSet,
                                allBalancesFile,
                                contractBalancesFile,
                                plainBalancesFile) {
  const contractBalanceMap = new Map();
  const plainBalancesMap = new Map();
  await eachLine(allBalancesFile, function(line) {
    const kv = line.trim().split(",");
    const addr = kv[0];
    const amountStr = kv[1];
    if (contractAddrSet.has(addr)) {
      contractBalanceMap.set(addr, amountStr);
    } else {
      plainBalancesMap.set(addr, amountStr);
    }
  });

  contractBalanceMap.forEach((v, k) => fs.appendFileSync(contractBalancesFile, k + "," + v + "\n"));
  plainBalancesMap.forEach((v, k) => fs.appendFileSync(plainBalancesFile, k + "," + v + "\n"));
}

async function main() {
  const dir = "./0506-5/";
  // const holdersFileBefore = dir + "holders_all_4100000_4350000.csv";
  const currHoldersFile = dir + "holders_all_" + startBlock + "_" + destBlock + ".csv";
  const currBalanceFile = dir + "balances_all_" + startBlock + "_" + destBlock + ".csv";
  // const balanceFileBefore = dir + "balances_all_4100000_4350000.csv";
  // const allBalanceFileSorted = allBalanceFile + ".sorted";
  // const mergedFile = dir + "holders_merged_4100000_" + destBlock + ".csv";
  // const stepFile = "block_steps.csv";

  // await getAllHolders(currHoldersFile);
  await getRecentHolders(currHoldersFile);

  // await getBalanceOfHolders(currHoldersFile, allBalanceFile);
  await getBalanceOfHoldersPlain(currHoldersFile, currBalanceFile);

  // mergeHoldersFile(holdersFileBefore, currHoldersFile, mergedFile);
  // const mergedBalancesFile = dir + "balances_all_" + destBlock + ".csv";
  // mergeFile(balanceFileBefore, allBalanceFile, mergedBalancesFile);
  // await deduplicateAndSort(allBalanceFile, allBalanceFileSorted);

  const previousBalanceFile = "balances_all_7707000.csv";
  const allBalanceFile = "balances_all_" + destBlock + ".csv";

  // await updateBalanceInfo(previousBalanceFile, currBalanceFile, allBalanceFile);
  // await getTotalAmount(allBalanceFile);

  const previousContractBalanceFile = "balances_contract_7707000.csv";
  const newContractBalanceFile = "balances_contract_" + destBlock + ".csv";
  const contractSet = await updateAllContractAddrs(previousContractBalanceFile, currBalanceFile);

  const newPlainBalancesFile = "balances_plain_" + destBlock + ".csv";
  await getPlainBalances(contractSet, allBalanceFile, newContractBalanceFile, newPlainBalancesFile);
}

async function main2() {
  const previousBalanceFile = "balances_all_7714800.csv";
  const previousContractBalanceFile = "balances_contract_7714800.csv";

  const dir = "./0508-2/";
  const currHoldersFile = dir + "holders_all_" + startBlock + "_" + destBlock + ".csv";
  const currBalanceFile = dir + "balances_all_" + startBlock + "_" + destBlock + ".csv";
  await getRecentHolders(currHoldersFile);
  await getBalanceOfHoldersPlain(currHoldersFile, currBalanceFile);

  const allBalanceFile = "balances_all_" + destBlock + ".csv";

  await updateBalanceInfo(previousBalanceFile, currBalanceFile, allBalanceFile);
  await calcTotalAmountAndAssert(allBalanceFile);

  const newContractBalanceFile = "balances_contract_" + destBlock + ".csv";
  const contractSet = await updateAllContractAddrs(previousContractBalanceFile, currBalanceFile);

  const newPlainBalancesFile = "balances_plain_" + destBlock + ".csv";
  await getPlainBalances(contractSet, allBalanceFile, newContractBalanceFile, newPlainBalancesFile);
}

// parseAllHoldersFromIssueEvents();

// getTotalAmount("./balances_plain_7707300.csv");
// getTotalAmount("./balances_contract_7714800.csv.sorted.nonzero");
// getTotalAmount("./balances_plain_7714800.csv.sorted.nonzero");

// calcTotalAmountAndAssert("balances_all_7714800.csv");

// compareBalanceFile("./balances_plain_7714800.csv", "./balances_plain_7714800.csv.sorted.nonzero");


main2();
