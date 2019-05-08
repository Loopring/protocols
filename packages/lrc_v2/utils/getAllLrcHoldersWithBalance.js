const _ = require("lodash");
const Promise = require("bluebird");
const async = require("async");
const fs = require("fs");
const lineReader = require("line-reader");

const Web3 = require("web3");
const web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/hM4sFGiBdqbnGTxk5YT2"));

const lrcAbi = '[{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"bonusPercentages","outputs":[{"name":"","type":"uint8"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"DECIMALS","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"BLOCKS_PER_PHASE","outputs":[{"name":"","type":"uint16"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"MAX_UNSOLD_RATIO","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"HARD_CAP","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"BASE_RATE","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[],"name":"close","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"saleStarted","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"issueIndex","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"recipient","type":"address"}],"name":"issueToken","outputs":[],"payable":true,"type":"function"},{"constant":false,"inputs":[{"name":"_firstblock","type":"uint256"}],"name":"start","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"hardCapReached","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"saleEnded","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"unsoldTokenIssued","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"price","outputs":[{"name":"tokens","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"GOAL","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"NAME","outputs":[{"name":"","type":"string"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"totalEthReceived","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"saleDue","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"target","outputs":[{"name":"","type":"address"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"NUM_OF_PHASE","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"remaining","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"firstblock","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"SYMBOL","outputs":[{"name":"","type":"string"}],"payable":false,"type":"function"},{"inputs":[{"name":"_target","type":"address"}],"payable":false,"type":"constructor"},{"payable":true,"type":"fallback"},{"anonymous":false,"inputs":[],"name":"SaleStarted","type":"event"},{"anonymous":false,"inputs":[],"name":"SaleEnded","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"caller","type":"address"}],"name":"InvalidCaller","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"msg","type":"bytes"}],"name":"InvalidState","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"issueIndex","type":"uint256"},{"indexed":false,"name":"addr","type":"address"},{"indexed":false,"name":"ethAmount","type":"uint256"},{"indexed":false,"name":"tokenAmount","type":"uint256"}],"name":"Issue","type":"event"},{"anonymous":false,"inputs":[],"name":"SaleSucceeded","type":"event"},{"anonymous":false,"inputs":[],"name":"SaleFailed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"}]'; // tslint:disable-line

const lrcAddr = "0xef68e7c694f40c8202821edf525de3782458639f";
const lrcToken = new web3.eth.Contract(JSON.parse(lrcAbi), lrcAddr);

let startBlock = 4104040;
let destBlock = 7127185;

const eachLine = Promise.promisify(lineReader.eachLine);

async function classifyHolders(allHoldersFile, plainHoldersFile, contractHoldersFile) {
  const isContract = async (addr) => {
    const code = await web3.eth.getCode(addr);
    if (code && code.length > 2) {
      return true;
    } else {
      return false;
    }
  };

  let i = 0;
  await eachLine(allHoldersFile, async function(line) {
    const addr = line.trim();
    const isContractAddress = await isContract(addr);
    if (isContractAddress) {
      fs.appendFileSync(contractHoldersFile, line + "\n");
    } else {
      fs.appendFileSync(plainHoldersFile, line + "\n");
    }

    i ++;
    if (i % 1000 === 0) {
      console.log("", i, "addresses classified.");
    }
  });
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
      holders.add(e.returnValues.from);
      holders.add(e.returnValues.to);
    });

    return holders;
  };

  const step = 10000;
  for (let i = startBlock; i <= destBlock; i += step) {
    const holdersInBlocks = await getHoldersInBlocks(i, i + step);
    holdersInBlocks.forEach(h => allHolders.add(h));
  }

  return allHolders;
}

// parse lrc holders from transaction data.
async function parseAllHolders() {
  let allHolders = new Set();

  const parseTokenRecipient = (input) => {
    if (input && input.length >= 74) {
      return "0x" + input.slice(34, 34 + 40);
    } else {
      return "";
    }
  };

  const processBlock = async (blockNumber) => {
    console.log("process block:", blockNumber);

    const holders = new Set();
    const blockData = await web3.eth.getBlock(blockNumber, true);
    blockData.transactions.forEach(tx => {
      if (tx.to && tx.to.toLowerCase() === lrcAddr) {
        if (web3.utils.isAddress(tx.from)) {
          holders.add(tx.from);
        }
        const recipient = parseTokenRecipient(tx.input);
        if (web3.utils.isAddress(recipient)) {
          holders.add(recipient);
        }
      }
    });
    return holders;
  };

  const processBlocks = async (blockFrom, blockTo) => {
    let holders = new Set();
    for (let i = blockFrom; i <= blockTo; i ++) {
      const holdersOfBlock = await processBlock(i);
      holders = new Set([...holders, ...holdersOfBlock]);
    }
    return holders;
  };

  allHolders = await processBlocks(startBlock, destBlock);

  return allHolders;
}

async function getBalanceOfHolders(addressesFile, destFile) {
  console.log("query balance:", addressesFile, "->", destFile);

  let i = 0;

  await eachLine(addressesFile, async function(line) {
    const addr = line.trim();
    const balance = await lrcToken.methods.balanceOf(addr).call(destBlock);
    if (balance > 0) {
      const balanceStr = balance.toString();
      const destLine = addr + "," + balanceStr + "\n";
      fs.appendFileSync(destFile, destLine);

      i ++;
      if (i % 1000 === 0) {
        console.log("query balance:", i, "addresses processed!");
      }
    }
  });
}

async function main() {
  console.log("start block:", startBlock, "; destBlock:", destBlock);

  const allHolders = await parseAllHoldersFromEvents();
  console.log("allHolders size:", allHolders.size);

  const allHoldersFile = "holders_all." + destBlock;
  allHolders.forEach(h => fs.appendFileSync(allHoldersFile, h + "\n"));

  const plainHoldersFile = "./holders_plain." + destBlock;
  const contractHoldersFile = "./holders_contract." + destBlock;

  await classifyHolders(allHoldersFile, plainHoldersFile, contractHoldersFile);

  const plainHoldersBalanceFile = "./balances_plain_" + destBlock + ".csv";
  const contractHoldersBalanceFile = "./balances_contract_" + destBlock + ".csv";

  await getBalanceOfHolders(plainHoldersFile, plainHoldersBalanceFile);
  await getBalanceOfHolders(contractHoldersFile, contractHoldersBalanceFile);
}

main();

// async function testGetBalance() {
//   const addr0 = "0x7B22713f2e818fad945AF5a3618a2814F102cbe0";
//   const addr = "0x6d4ee35d70ad6331000e370f079ad7df52e75005";
//   const balance1 = await lrcToken.methods.balanceOf(addr).call(7081231);
//   const balance2 = await lrcToken.methods.balanceOf(addr).call(7081232);
//   const balance3 = await lrcToken.methods.balanceOf(addr).call(7081233);

//   console.log(balance1/1e18, balance2/1e18, balance3/1e18);

// }

// testGetBalance();
