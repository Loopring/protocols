const Web3 = require("web3");
const web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/hM4sFGiBdqbnGTxk5YT2"));

const newLrcAbi = '';

const newLrcAddress = "";
const newLrcToken = new web3.eth.Contract(JSON.parse(newLrcAbi), newLrcAddress);

async function setup() {
  const args = process.argv.slice(2);
  const balanceFile = args[0];


}
