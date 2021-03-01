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
const exchangeAddress = "0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4";

async function listPendingDeposits(blocksAhead: number) {
  const depositEvents = await myEth.getEvents(
    "ABI/version36/ExchangeV3.abi",
    exchangeAddress,
    "DepositRequested",
    blocksAhead
  );

  console.log("depositEvents length:", depositEvents.length);
  const recheckMap = new Map();
  const pendingDeposits: any[] = [];

  for (const e of depositEvents) {
    // check withdrawable amount:
    const to = e.returnValues.to;
    if (recheckMap.has(to)) {
      continue;
    }

    const txhash = e.transactionHash;

    const token = e.returnValues.token;
    const pendingAmount = await myEth.call(
      "ABI/version36/ExchangeV3.abi",
      exchangeAddress,
      "getPendingDepositAmount",
      to,
      token
    );

    console.log("pendingAmount:", pendingAmount);
    if (pendingAmount > 0) {
      recheckMap.set(to, token);
      pendingDeposits.push({ txhash, to, token, pendingAmount });
    }
  }

  // console.log("pending deposits:", JSON.stringify([...recheckMap]));
  console.log(
    "pending deposits",
    JSON.stringify(pendingDeposits, undefined, 2)
  );
}

async function main() {
  await listPendingDeposits(1000);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
