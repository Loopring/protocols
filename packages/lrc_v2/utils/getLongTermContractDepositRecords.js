const fs = require("fs");
const Web3 = require("web3");
const web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/hM4sFGiBdqbnGTxk5YT2"));

const longTermContractAbi = '[{"constant":true,"inputs":[],"name":"WITHDRAWAL_DELAY","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"lrcBalance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"withdrawId","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_lrcWithdrawalBase","type":"uint256"}],"name":"getBonus","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"lrcTokenAddress","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"depositStartTime","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"withdrawLRC","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":true,"inputs":[],"name":"depositStopTime","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"depositId","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"drain","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"lrcDeposited","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"WITHDRAWAL_SCALE","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"start","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"DRAIN_DELAY","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"depositLRC","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":true,"inputs":[],"name":"DEPOSIT_PERIOD","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[{"name":"_lrcTokenAddress","type":"address"},{"name":"_owner","type":"address"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_time","type":"uint256"}],"name":"Started","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_lrcAmount","type":"uint256"}],"name":"Drained","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_depositId","type":"uint256"},{"indexed":true,"name":"_addr","type":"address"},{"indexed":false,"name":"_lrcAmount","type":"uint256"}],"name":"Deposit","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_withdrawId","type":"uint256"},{"indexed":true,"name":"_addr","type":"address"},{"indexed":false,"name":"_lrcAmount","type":"uint256"}],"name":"Withdrawal","type":"event"}]';

const longTermContractAddress = "0x239dE3a0D6ca5f21601f83327eA2174225eB7156";
const longTermContract = new web3.eth.Contract(JSON.parse(longTermContractAbi), longTermContractAddress);

async function getAllDepositRecords() {
  const allDepositEvents = await longTermContract.getPastEvents(
    "Deposit",
    {
      fromBlock: 4104040,
      toBlock: "latest"
    }
  );

  console.log("events size:",  allDepositEvents.length);

  fs.appendFileSync("longterm-all-deposits.txt", JSON.stringify(allDepositEvents, null, 2));

  // console.log(allDepositEvents[0]);
  // const allEvents = allDepositEvents.map(e => parseEvent(e));

  // let dest = {};
  // allEvents.foreach(e => {
  //   if (e.user === "0xf10902defa142a89c63d98322460a66dda3654cb") {
  //     dest = e;
  //   }
  // });

  // console.log(dest);
  // const timestamp = await web3.getBlock(dest.blockNumber).timestamp;
  // console.log("timestamp:", timestamp);

  return allDepositEvents;
}

function parseEvent(event) {
  const blockNumber = event.blockNumber;
  const txHash = event.transactionHash;
  const Result = event.returnValues.Result;
  const user = Result["1"].toLowerCase();

  return {blockNumber, txHash, Result};
}

getAllDepositRecords();
