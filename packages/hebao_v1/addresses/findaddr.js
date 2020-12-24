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
    salt,
    score
  };

  return result;
}

function findTopAddressesInBatch(nextBatch, minScore) {
  const prettyOnes = [];
  const uglyOnes = [];

  const base = nextBatch * batchSize;

  for (let i = 0; i < batchSize; i++) {
    const addr = calAddress(nextBatch, i + base);

    if (addr.score > minScore) {
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

  let cmd = process.argv.slice(2)[0];
  if (cmd === "find") {
    let chunk = parseInt(process.argv.slice(2)[1]);
    return findAddresses(chunk);
  }

  if (cmd === "export") {
    let chunk = parseInt(process.argv.slice(2)[1]);
    return exportAddresses(chunk);
  }
}

//-----------------------------------
function exportAddresses(chunkIdx) {
  if (chunkIdx < 0) {
    console.log("invalid chunk");
    return;
  }

  let result = loadExports();
  let chunk = loadChunk(chunkIdx);

  result.prettyOnes = result.prettyOnes
    .concat(chunk.prettyOnes)
    .sort((a, b) => b.score - a.score);
  result.uglyOnes = result.uglyOnes
    .concat(chunk.uglyOnes)
    .sort((a, b) => a.score - b.score);

  saveExports(result.prettyOnes, result.uglyOnes);

  chunk.prettyOnes = [];
  chunk.uglyOnes = [];
  saveChunk(chunkIdx, chunk);
  console.log(chunk);
}

//-----------------------------------

function loadChunk(chunkIdx) {
  let config = {
    nextBatch: chunkIdx * 1000000,
    untilBatch: (chunkIdx + 1) * 1000000,
    select: 1000
  };

  let file = location + "chunk_" + chunkIdx + ".json";
  let prettyOnes = [];
  let uglyOnes = [];

  if (fs.existsSync(file)) {
    try {
      const result = JSON.parse(fs.readFileSync(file));
      config = result.config || config;
      prettyOnes = result.prettyOnes || [];
      uglyOnes = result.uglyOnes || [];
    } catch (err) {}
  }

  return {
    config: config,
    prettyOnes: prettyOnes,
    uglyOnes: uglyOnes
  };
}

function saveChunk(chunkIdx, chunk) {
  let file = location + "chunk_" + chunkIdx + ".json";
  fs.writeFileSync(file, JSON.stringify(chunk, undefined, 2));
}

function loadExports() {
  let file = "exports.json";
  let prettyOnes = [];
  let uglyOnes = [];

  if (fs.existsSync(file)) {
    try {
      const result = JSON.parse(fs.readFileSync(file));
      prettyOnes = result.prettyOnes || [];
      uglyOnes = result.uglyOnes || [];
    } catch (err) {}
  }
  return {
    prettyOnes: prettyOnes,
    uglyOnes: uglyOnes
  };
}

function saveExports(prettyOnes, uglyOnes) {
  let file = "exports.json";
  let result = {
    prettyOnes: prettyOnes,
    uglyOnes: uglyOnes
  };
  fs.writeFileSync(file, JSON.stringify(result, undefined, 2));
}

function findAddresses(chunkIdx) {
  if (chunkIdx < 0) {
    console.log("invalid chunk");
    return;
  }

  let chunk = loadChunk(chunkIdx);

  while (
    chunk.config.untilBatch <= 0 ||
    chunk.config.untilBatch > chunk.config.nextBatch
  ) {
    const startTime = new Date().getTime();
    let minScore = 0;
    let maxScore = 0;
    if (chunk.prettyOnes && chunk.prettyOnes.length > 0) {
      minScore = chunk.prettyOnes[chunk.prettyOnes.length - 1].score;
      maxScore = chunk.prettyOnes[0].score;
    }

    if (minScore < 0.4) {
      filterScore = 0.4;
    } else {
      filterScore = minScore;
    }

    let remaining = chunk.config.untilBatch - chunk.config.nextBatch;
    let pctg =
      (((1000000 - remaining) * 100.0) / 1000000).toString().slice(0, 8) + "%";
    console.log(
      "chunk:" + chunkIdx,

      pctg,
      "select:" + chunk.config.select,
      "pretty:" + (chunk.prettyOnes ? chunk.prettyOnes.length : 0),
      "time:" +
        (chunk.config.timeUsedLastBatch / 1000).toString().slice(0, 2) +
        "s",

      "score:" +
        minScore.toString().slice(0, 5) +
        "-" +
        maxScore.toString().slice(0, 5)
    );

    let res = findTopAddressesInBatch(chunk.config.nextBatch, filterScore);

    chunk.prettyOnes = chunk.prettyOnes
      .concat(res[0])
      .sort((a, b) => b.score - a.score)
      .slice(0, chunk.config.select);

    chunk.uglyOnes = chunk.uglyOnes
      .concat(res[1])
      .sort((a, b) => a.score - b.score)
      .slice(0, chunk.config.select);

    chunk.config.nextBatch++;

    const endTime = new Date().getTime();
    chunk.config.timeUsedLastBatch = endTime - startTime;

    saveChunk(chunkIdx, chunk);
  }
  console.log("done");
}

main();

// console.log("addr:", computeAddress(zeroAddress, 123));
