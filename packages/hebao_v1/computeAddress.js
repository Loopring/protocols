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

function scoreString(str) {
  var uniql = "";
  var p = 0;
  for (var x = 0; x < str.length; x++) {
    if (uniql.indexOf(str.charAt(x)) == -1) {
      uniql += str[x];
      if (str[x] >= "A" && str[x] <= "z") {
        p += 1;
      } else if (str[x] == "4") {
        p += 0.4;
      } else if (
        str[x] == "1" ||
        str[x] == "2" ||
        str[x] == "3" ||
        str[x] == "5" ||
        str[x] == "7"
      ) {
        p += 0.3;
      } else if (str[x] == "9") {
        p += 0.2;
      } else if (str[x] == "6" || str[x] == "8") {
        p += 0.1;
      }
    }
  }
  var score = 10 + (90.0 * (str.length - uniql.length)) / (str.length - 1);
  score *= (20 - p) / 20;

  return score;
}

function calAddress(batch, salt) {
  const addr = computeAddress(zeroAddress, salt);
  const headScore = scoreString(addr.slice(2, 2 + endingSize));
  const tailScore = scoreString(addr.slice(0 - endingSize));
  const concatScore = scoreString(
    addr.slice(2, 2 + endingSize) + addr.slice(0 - endingSize)
  );

  const score =
    (headScore * headScore +
      tailScore * tailScore +
      concatScore * concatScore) /
    30000;
  const result = {
    addr,
    batch,
    salt,
    score,
    headScore,
    tailScore,
    concatScore
  };

  return result;
}

function findTopAddressesInBatch(nextBatch) {
  const prettyOnes = [];
  const uglyOnes = [];

  const base = nextBatch * batchSize;

  for (let i = 0; i < batchSize; i++) {
    const addr = calAddress(nextBatch, i + base);

    if (addr.score >= 0.47) {
      console.log(addr);
      prettyOnes.push(addr);
    } else if (addr.score <= 0.0037) {
      // console.log("\t", addr);
      uglyOnes.push(addr);
    }
  }

  return [prettyOnes, uglyOnes];
}

function main() {
  // if (!fs.existsSync(`wallet_addr`)) {
  //     fs.mkdirSync(`wallet_addr`);
  // }

  let chunk = parseInt(process.argv.slice(2)[0]);
  if (chunk < 0) {
    console.log("invalid chunk");
    return;
  }

  console.log("chunk: ", chunk);

  let config = {
    nextBatch: chunk * 1000000,
    untilBatch: (chunk + 1) * 1000000,
    selectPerMillion: 0.1
  };

  let file = location + "addresses" + chunk + ".json";
  let prettyOnes = [];
  let uglyOnes = [];

  if (fs.existsSync(file)) {
    try {
      const result = JSON.parse(fs.readFileSync(file));
      config = result.config || config;
      prettyOnes = result.pretty || [];
      uglyOnes = result.ugly || [];
    } catch (err) {}
  }

  while (config.untilBatch <= 0 || config.untilBatch > config.nextBatch) {
    const startTime = new Date().getTime();
    console.log(
      ">>> batch:",
      config.nextBatch,
      " until batch:",
      config.untilBatch,
      " select per million:",
      config.selectPerMillion,
      " pretty:",
      prettyOnes.length,
      " ugly:",
      uglyOnes.length,
      " time used:",
      config.timeUsedLastBatch / 1000
    );

    let res = findTopAddressesInBatch(config.nextBatch);

    var select = config.selectPerMillion * (config.nextBatch + 1);
    if (select < 10) {
      select = 10;
    }

    prettyOnes = prettyOnes
      .concat(res[0])
      .sort((a, b) => b.score - a.score)
      .slice(0, select);

    uglyOnes = uglyOnes
      .concat(res[1])
      .sort((a, b) => a.score - b.score)
      .slice(0, select);

    config.nextBatch++;

    const endTime = new Date().getTime();
    config.timeUsedLastBatch = endTime - startTime;

    let result = {
      config: config,
      prettyCount: prettyOnes.length,
      uglyCount: uglyOnes.length,
      pretty: prettyOnes,
      ugly: uglyOnes
    };

    fs.writeFileSync(file, JSON.stringify(result, undefined, 2));
  }
  console.log("done");
}

main();

// console.log("addr:", computeAddress(zeroAddress, 123));
