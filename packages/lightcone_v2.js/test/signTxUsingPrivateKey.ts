import { exchange } from "../src";
import { PrivateKeyAccount } from "../src/lib/wallet/ethereum/walletAccount";
const Web3 = require("web3");
const fs = require("fs");
const exchangeABIJson = require("./exchange.json");

describe("sign transaction using private key", function() {
  this.timeout(10000);
  before(async () => {});

  it("send tx", async () => {
    await exchange.init("http://localhost:8545");
    let privateKeyAccount = new PrivateKeyAccount(
      "7C71142C72A019568CF848AC7B805D21F2E0FD8BC341E8314580DE11C6A397BF"
    );

    // console.log("exchange:", exchange);

    const web3 = new Web3(
      new Web3.providers.HttpProvider("http://localhost:8545")
    );
    const exchangeInstance = new web3.eth.Contract(
      exchangeABIJson,
      "0x3d88d9C4adC342cEff41855CF540844268390BE6"
    );

    console.log("exchangeInstance：", exchangeInstance);

    const fees = await exchangeInstance.methods.getFees().call();
    console.log("fees:", fees);

    const updateAccountResponse = await exchange.updateAccount(
      privateKeyAccount,
      1
    );
  });
});
