const fs = require("fs");
const ethUtil = require("ethereumjs-util");

// Creation code on mainnet:
const creationCode =
  "3d602d80600a3d3981f3363d3d373d3d3d363d73d2b58140f90d66f73acbe873a81e5ae06a6d61195af43d82803e903d91602b57fd5bf3";

const codeHash = ethUtil.keccak(Buffer.from(creationCode, "hex"));
const factory = "0xDB42E6F6cB2A2eFcF4c638cb7A61AdE5beD82609";

function computeAddress(owner, baseURI) {
  if (owner.startsWith("0x")) {
    owner = owner.slice(2);
  }

  const saltBuf = Buffer.concat([
    Buffer.from("NFT_CONTRACT_CREATION", "utf8"),
    Buffer.from(owner, "hex"),
    Buffer.from(baseURI, "utf8")
  ]);

  const saltHash = ethUtil.keccak(saltBuf);

  const rawBuf = Buffer.concat([
    Buffer.from("ff", "hex"),
    Buffer.from(factory.slice(2), "hex"),
    saltHash,
    codeHash
  ]);

  const addr = ethUtil
    .keccak(rawBuf)
    .slice(12)
    .toString("hex");
  return ethUtil.toChecksumAddress("0x" + addr);
}

function main() {
  const owner = "0x" + "12".repeat(20);
  const baseURI = "http://123";
  console.log(owner, baseURI);
  const contractAddress = computeAddress(owner, baseURI);
  console.log("contractAddress:", contractAddress);
}

main();
