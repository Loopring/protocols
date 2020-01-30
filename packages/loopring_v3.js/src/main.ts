import { Explorer } from "./explorer";
import Web3 from "web3";
const assert = require("assert");
eval("global.assert = assert;");

async function main() {
  const explorer = await new Explorer();
  const ethNodeUrl = "https://mainnet.infura.io/v3/a06ed9c6b5424b61beafff27ecc3abf3";
  const web3 = new Web3(new Web3.providers.HttpProvider(ethNodeUrl));
  const universalRegistryAddress = "0x4c2103152a1A402af283fa52903569f05477611f";
  explorer.initialize(web3, universalRegistryAddress);

  const blockFrom = 8967526;
  const blockTo = 9252045;
  const step = 100;

  for (let i = blockFrom; i <= blockTo; i += step ) {
    await explorer.sync(i);
  }
  // explorer.sync(9252045);

  const exchange = explorer.getExchange(0);
  exchange.buildMerkleTreeForWithdrawalMode();
  const withdrawData = exchange.getWithdrawFromMerkleTreeData(20, 2);
  console.log("withdrawData:", withdrawData);
}

main();
