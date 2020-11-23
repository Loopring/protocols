const fs = require("fs");
const ethUtil = require("ethereumjs-util");

// Creation code on mainnet:
const creationCode =
  "3d602d80600a3d3981f3363d3d373d3d3d363d73e5857440bbff64c98ceb70d650805e1e96adde7a5af43d82803e903d91602b57fd5bf3";

const codeHash = ethUtil.keccak(Buffer.from(creationCode, "hex"));
const zeroAddress = "0x" + "00".repeat(20);
const walletFactory = "0x9fAD9FFceA95c345D41055a63bD099E1a0576109";
const batchSize = 1000000;
const endingSize = 8;
const location = "./";
console.log("Using WalletFactory:", walletFactory);

function computeAddress(owner, salt) {
  if (owner.startsWith("0x")) {
    owner = owner.slice(2);
  }

  const saltHex = Number(salt).toString(16);
  const saltHex256 = "0".repeat(64 - saltHex.length) + saltHex;
  const saltBuf = Buffer.concat([
    Buffer.from("WALLET_CREATION", "utf8"),
    Buffer.from(owner, "hex"),
    Buffer.from(saltHex256, "hex")
  ]);

  const saltHash = ethUtil.keccak(saltBuf);

  const rawBuf = Buffer.concat([
    Buffer.from("ff", "hex"),
    Buffer.from(walletFactory.slice(2), "hex"),
    saltHash,
    codeHash
  ]);

  const addr = ethUtil
    .keccak(rawBuf)
    .slice(12)
    .toString("hex");
  return ethUtil.toChecksumAddress(addr);
}

function findAddressesInBatch(batch, dateSet) {
  const result = [];
  const base = batch * batchSize;
  for (let i = 0; i < batchSize; i++) {
    const salt = i + base;
    const addr = computeAddress(zeroAddress, i + base);
    const date = addr.slice(2, 6) + addr.slice(-4);
    if (dateSet.has(date)) {
      const addrObj = { addr, salt };
      console.log("address found:", addrObj);
      result.push(addrObj);
    }
  }

  return result;
}

Date.prototype.addDays = function(days) {
  const date = new Date(this.valueOf());
  date.setDate(date.getDate() + days);
  return date;
};

function getDates(startDate, stopDate) {
  const dateSet = new Set();
  let currentDate = startDate;
  while (currentDate <= stopDate) {
    const currentDateStr = new Date(currentDate)
      .toISOString()
      .slice(0, 10)
      .replace(/-/gi, "");
    dateSet.add(currentDateStr);
    currentDate = currentDate.addDays(1);
  }
  return dateSet;
}

function main() {
  let config = { nextBatch: 0 };
  let file = location + "addresses-birthday.json";
  if (fs.existsSync(file)) {
    try {
      const result = JSON.parse(fs.readFileSync(file));
      config = result.config || config;
    } catch (err) {}
  }
  let addresses = [];

  const dateSet = getDates(new Date("1980-01-01"), new Date("2020-12-30"));
  // console.log("dateSet:", dateSet);

  while (true) {
    const startTime = new Date().getTime();
    console.log(
      ">>> batch:",
      config.nextBatch,
      " count:",
      addresses.length,
      " time used:",
      config.timeUsedLastBatch / 1000
    );

    let res = findAddressesInBatch(config.nextBatch, dateSet);
    addresses = addresses.concat(res);

    config.nextBatch++;

    const endTime = new Date().getTime();
    config.timeUsedLastBatch = endTime - startTime;

    let result = {
      config: config,
      count: addresses.length,
      addresses
    };

    fs.writeFileSync(file, JSON.stringify(result, undefined, 2));
  }
}

main();

// console.log("addr:", computeAddress(zeroAddress, 123));
