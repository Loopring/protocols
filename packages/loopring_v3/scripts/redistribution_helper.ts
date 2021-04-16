import * as fs from "fs";
import {
  execAsync,
  newWeb3WithPrivateKey,
  Eth,
  infuraUrlMain,
  zeroAddress
} from "@freemanz/ts-utils";
const assert = require("assert");

const web3 = newWeb3WithPrivateKey("0x" + "11".repeat(32), infuraUrlMain);

const myEth = new Eth(web3, false);
const defaultTxOpts = {
  gasPrice: 85e9,
  gasLimit: 500000
};

const exchangeAddress = "0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4";
async function getFailedDistributions(blocksAhead: number) {
  const failedEvents = await myEth.getEvents(
    "ABI/version36/ExchangeV3.abi",
    exchangeAddress,
    "WithdrawalFailed",
    blocksAhead
  );

  console.log("failedEvents length:", failedEvents.length);
  const recheckMap = new Map();

  for (const e of failedEvents) {
    // check withdrawable amount:
    const to = e.returnValues.to;
    if (recheckMap.has(to)) {
      continue;
    }

    const token = e.returnValues.token;
    const withdrawableAmount = await myEth.call(
      "ABI/version36/ExchangeV3.abi",
      exchangeAddress,
      "getAmountWithdrawable",
      to,
      token
    );

    console.log("withdrawableAmount:", withdrawableAmount);
    if (withdrawableAmount > 0) {
      recheckMap.set(to, token);
    }
  }

  const owners: string[] = [];
  const tokens: string[] = [];
  for (const o of recheckMap.keys()) {
    const token = recheckMap.get(o);
    owners.push(o);
    tokens.push(token);
  }

  console.log("owners:", JSON.stringify(owners));
  console.log("tokens:", JSON.stringify(tokens));
}

async function main() {
  await getFailedDistributions(50000);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
