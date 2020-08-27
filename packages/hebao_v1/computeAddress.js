const fs = require("fs");
const ethUtil = require("ethereumjs-util");

// const creationCode = "608060405234801561001057600080fd5b506101bc806100206000396000f3fe60806040526004361061002d5760003560e01c80635c60da1b14610078578063d784d426146100a957610034565b3661003457005b600061003e6100de565b90506001600160a01b03811661005357600080fd5b60405136600082376000803683855af43d806000843e818015610074578184f35b8184fd5b34801561008457600080fd5b5061008d6100de565b604080516001600160a01b039092168252519081900360200190f35b3480156100b557600080fd5b506100dc600480360360208110156100cc57600080fd5b50356001600160a01b0316610103565b005b7f49e52b53564741f5cdd331b330c04deb825a37506ec265623007d3f13f9371f85490565b600061010d6100de565b90506001600160a01b03811615610161576040805162461bcd60e51b8152602060048201526013602482015272494e495449414c495a45445f414c524541445960681b604482015290519081900360640190fd5b507f49e52b53564741f5cdd331b330c04deb825a37506ec265623007d3f13f9371f85556fea2646970667358221220111cbc448818bbfa55c66c3c4c62006ccee3717006204ab1d4b2e52803cf4e2864736f6c63430007000033";

// Creation code on mainnet:
const creationCode =
  "608060405234801561001057600080fd5b506101f0806100206000396000f3fe60806040526004361061002d5760003560e01c80635c60da1b14610078578063d784d426146100a357610034565b3661003457005b600061003e6100c5565b90506001600160a01b03811661005357600080fd5b60405136600082376000803683855af43d806000843e818015610074578184f35b8184fd5b34801561008457600080fd5b5061008d6100c5565b60405161009a9190610179565b60405180910390f35b3480156100af57600080fd5b506100c36100be36600461014b565b6100ea565b005b7f49e52b53564741f5cdd331b330c04deb825a37506ec265623007d3f13f9371f85490565b60006100f46100c5565b90506001600160a01b038116156101265760405162461bcd60e51b815260040161011d9061018d565b60405180910390fd5b507f49e52b53564741f5cdd331b330c04deb825a37506ec265623007d3f13f9371f855565b60006020828403121561015c578081fd5b81356001600160a01b0381168114610172578182fd5b9392505050565b6001600160a01b0391909116815260200190565b602080825260139082015272494e495449414c495a45445f414c524541445960681b60408201526060019056fea2646970667358221220bfc82b77bd375f9661de56a7e362250c6978e638dedc676505fcf5a8c791a11664736f6c63430007000033";

const codeHash = ethUtil.keccak(Buffer.from(creationCode, "hex"));
const zeroAddress = "0x" + "00".repeat(20);

const walletFactory = "0x0c8dBFB40A324674AD26fe7AecCd4C654036Aa82";
console.log("using WalletFactory:", walletFactory);

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

  const addr =
    "0x" +
    ethUtil
      .keccak(rawBuf)
      .slice(12)
      .toString("hex");
  return ethUtil.toChecksumAddress(addr);
}

function isIdentical(str) {
  if (str.length < 2) return true;
  for (let i = 1; i < str.length; i++) {
    if (str[i] !== str[0]) {
      return false;
    }
  }
  return true;
}

function calcScore(hexstr, isTail = false) {
  let score = 10;

  const len = hexstr.length;
  if (isIdentical(hexstr.slice(0, 6))) score += 50;
  else if (isIdentical(hexstr.slice(0, 5))) score += 40;
  else if (isIdentical(hexstr.slice(0, 4))) score += 30;
  else if (isIdentical(hexstr.slice(0, 3))) score += 20;
  else if (isIdentical(hexstr.slice(0, 2))) score += 10;

  if (score > 10 && isTail) score += 10;

  const arrLower = Array.from(hexstr.toLowerCase());
  const charSet = new Set();
  for (const ch of arrLower) {
    charSet.add(ch);
  }
  score -= charSet.size;

  const arr = Array.from(hexstr);
  const charSet2 = new Set();
  for (const ch of arr) {
    charSet2.add(ch);
  }
  score -= charSet2.size;

  return score;
}

function findTop50FromRange(from, to) {
  const result = [];
  for (let i = from; i < to; i++) {
    const addr = computeAddress(zeroAddress, i);
    const prefixScore = calcScore(addr.slice(2, 8));
    const tailScore = calcScore(
      addr
        .slice(-6)
        .split("")
        .reverse()
        .join(""),
      true
    );
    let score = prefixScore + tailScore;
    if (addr[2] === addr[addr.length - 1]) {
      score += 20;
    }

    if (score > 20) {
      result.push({ score, addr, salt: i });
    }
  }

  console.log(
    `from: ${from}, to: ${to}, batch length(score > 20): ${result.length}`
  );
  result.sort((a, b) => b.score - a.score);
  return result.slice(0, 50);
}

function findNormalAddrs(from, to, resAmount) {
  const result = [];
  let i = 0;
  for (i = from; i < to; i++) {
    const addr = computeAddress(zeroAddress, i);
    const prefixScore = calcScore(addr.slice(2, 8));
    const tailScore = calcScore(
      addr
        .slice(-6)
        .split("")
        .reverse()
        .join(""),
      true
    );
    let score = prefixScore + tailScore;
    if (addr[2] === addr[addr.length - 1]) {
      score += 20;
    }

    if (score < 10) {
      console.log({ score, addr, salt: i });
      result.push({ score, addr, salt: i });
    }

    if (result.length >= resAmount) break;
  }

  // write to file:
  if (result.length > 0) {
    const fileName = `plainBlankAddrs-${from}-${i}.json`;
    fs.writeFileSync(fileName, JSON.stringify(result, undefined, 2));
  }

  return result;
}

function findPreciousBlankAddrs(from, to, resAmount) {
  let total = [];
  const step = 10000;
  for (let i = from; i < to; i += step) {
    let stepTo = i + step;
    if (stepTo > to) stepTo = to;
    const res = findTop50FromRange(i, stepTo);
    total = total.concat(res);
  }

  total.sort((a, b) => b.score - a.score);
  total = total.slice(0, resAmount);
  console.log("totoal:", total);

  // write to file:
  const fileName = `prettyBlankAddrs-${from}-${to}.json`;
  fs.writeFileSync(fileName, JSON.stringify(total, undefined, 2));

  return total;
}

function main() {
  const args = process.argv.slice(2);
  // compute blank wallet address:
  if (args.length < 1) {
    console.log("usage:", process.argv[0], process.argv[1], "<salt>");
    process.exit(1);
  }
  const addr = computeAddress(zeroAddress, args[0]);
  console.log("addr:", addr);
}

// main();

findPreciousBlankAddrs(0, 1000000, 100);

// findNormalAddrs(0, 1000, 100);
