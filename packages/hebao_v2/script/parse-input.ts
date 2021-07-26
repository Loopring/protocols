const hre = require("hardhat");
const ethers = hre.ethers;
import { attachWallet } from "../test/commons";
import { MetaTx, signMetaTx } from "../test/helper/signatureUtils";

function decodeMetaTx() {
  const input =
    "0xc02f2a370000000000000000000000000dfa9b2ab43b881430b6f52122618cc6b8f3a2c90000000000000000000000000000000000000000000000000000017aaee179340000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000024000000000000000000000000000000000000000000000000000000000000000e4b9806d9900000000000000000000000000000000000000000000000000000000000000000000000000000000000000006b1029c9ae8aa5eea9e045e8ba3c93d380d5bdda0000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000230780000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000426136fb1fb555a4fe0a5a075023e5828f30f32e3accd4922932f0410a7b2606f62be43017a05cf7cda089e87e6dc82a7dbccc08c5127b12a85f0b18b47bc575331b02000000000000000000000000000000000000000000000000000000000000";
  const iface = new ethers.utils.Interface([
    "function executeMetaTx(address to, uint256 nonce, address gasToken, uint256 gasPrice, uint256 gasLimit, uint256 gasOverhead, bool requiresSuccess, bytes data, bytes signature)"
  ]);
  const res = iface.parseTransaction({ data: input, value: "0" });
  // console.log("res:", res);
  return res;
}

async function signMetaTxTest() {
  const walletAddr = "0x0dfa9b2ab43b881430b6f52122618cc6b8f3a2c9";
  // const masterCopy = "";
  const wallet = await attachWallet(walletAddr);
  const masterCopy = await wallet.getMasterCopy();
  console.log("masterCopy:", masterCopy);
  const sender = "0xb259d7f2042b168c60fd5593d1a84327581dd89e";
  const dataParsed = decodeMetaTx().args;
  console.log("dataParsed:", dataParsed);

  const metaTx: MetaTx = {
    sender: sender,
    to: dataParsed.to,
    nonce: dataParsed.nonce,
    gasToken: dataParsed.gasToken,
    gasPrice: dataParsed.gasPrice,
    gasLimit: dataParsed.gasLimit,
    gasOverhead: dataParsed.gasOverhead,
    requiresSuccess: dataParsed.requiresSuccess,
    data: Buffer.from(dataParsed.data.slice(2), "hex"),
    signature: Buffer.from(dataParsed.slice(2), "hex")
  };

  console.log("metaTx:", metaTx);
  const signRes = signMetaTx(masterCopy, metaTx, "");
  console.log("signRes:", signRes);
}

async function main() {
  await signMetaTxTest();
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
