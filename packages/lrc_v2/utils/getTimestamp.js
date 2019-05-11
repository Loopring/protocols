const Web3 = require("web3");
const web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/hM4sFGiBdqbnGTxk5YT2"));
const fs = require("fs");

const allDeposits = require("./longterm-all-deposits.json");

function parseEvent(event) {
  const blockNumber = event.blockNumber;
  const txHash = event.transactionHash;
  const Result = event.returnValues;
  const user = event.returnValues._addr.toLowerCase();
  const lrcAmount = parseInt(event.returnValues._lrcAmount)/1e18;

  return {txHash, user, lrcAmount};
}

const deposits = allDeposits.map(e => parseEvent(e));
console.log("deposits:", deposits.length);
const resFile = "longterm-all-deposits.csv";

fs.appendFileSync(resFile, "txHash,user,lrcAmount\n");
deposits.forEach(item => {
  const line = item.txHash + "," + item.user + "," + item.lrcAmount + "\n";
  fs.appendFileSync(resFile, line);
});
