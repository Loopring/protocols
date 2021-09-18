const hre = require("hardhat");
const ethers = hre.ethers;
import { attachWallet } from "../test/commons";
import { MetaTx, signMetaTx, signRecover } from "../test/helper/signatureUtils";
import { sign2, verifySignature, recoverECDSA } from "../test/helper/Signature";
import BN = require("bn.js");

async function getWalletIface() {
  const walletContract = await ethers.getContractFactory("SmartWallet", {
    libraries: {
      ERC1271Lib: ethers.constants.AddressZero,
      ERC20Lib: ethers.constants.AddressZero,
      GuardianLib: ethers.constants.AddressZero,
      InheritanceLib: ethers.constants.AddressZero,
      LockLib: ethers.constants.AddressZero,
      MetaTxLib: ethers.constants.AddressZero,
      QuotaLib: ethers.constants.AddressZero,
      RecoverLib: ethers.constants.AddressZero,
      UpgradeLib: ethers.constants.AddressZero,
      WhitelistLib: ethers.constants.AddressZero
    }
  });

  return walletContract.interface;
}

async function walletERC1271Test(
  walletAddr: string,
  hash: string,
  signature: string
) {
  const wallet = await attachWallet(walletAddr);

  const message = Buffer.from(hash.slice(2), "hex");
  const recoveredAddr = recoverECDSA(message, signature);
  console.log("recovered address:", recoveredAddr);

  const isValid = await wallet.isValidSignature(hash, signature);
  console.log("isValid:", isValid);
}

async function verifySignatureERC1271(
  officialGuardianAddr: string,
  hash: string,
  signature: string
) {
  const officialGuardian = await (await ethers.getContractFactory(
    "OfficialGuardian"
  )).attach(officialGuardianAddr);

  const message = Buffer.from(hash.slice(2), "hex");
  const recoveredAddr = recoverECDSA(message, signature);
  console.log("recovered address:", recoveredAddr);

  const isManager = await officialGuardian.isManager(recoveredAddr);
  console.log("isManager:", isManager);
  const isValid = await officialGuardian.isValidSignature(hash, signature);
  console.log("isValid:", isValid);
}

async function decodeResult() {
  const walletIface = await getWalletIface();
  const resData =
    "0x000000000000000000000000f56c67163a5e2223c4f7cf53d005f55e0bc0c4ac00000000000000000000000000000000000000000000000000000000610114850000000000000000000000000000000000000000000000000000017aeced97210000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000b1a2bc2ec50000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000061027850";

  const decoded = walletIface.decodeFunctionResult("wallet", resData);
  console.log("decoded:", decoded);
}

function decodeWithABI(abi: string, input: string) {
  const abiJson = JSON.parse(abi);
  const iface = new ethers.utils.Interface(abiJson);

  const res = iface.parseTransaction({ data: input, value: "0" });
  console.log("res:", res);
  return res;
}

async function decodeWalletInput(input: string) {
  // const iface = new ethers.utils.Interface([
  //   "function executeMetaTx(address to, uint256 nonce, address gasToken, uint256 gasPrice, uint256 gasLimit, uint256 gasOverhead, bool requiresSuccess, bytes data, bytes signature)"
  // ]);

  const iface = await getWalletIface();
  const res = iface.parseTransaction({ data: input, value: "0" });
  console.log("res:", res);
  return res;
}

async function decodeWalletFactoryInput(input: string) {
  const iface = (await ethers.getContractFactory("WalletFactory")).interface;
  const res = iface.parseTransaction({ data: input, value: "0" });
  console.log("res:", res);
  console.log("salt:", res.args.config.salt.toString());
  return res;
}

export async function decodeMetaTx(input: string) {
  const metaTx = await decodeWalletInput(input);

  const innerTx = await decodeWalletInput(metaTx.args.data);

  console.log("innerTx:", innerTx.args.approval);
  return innerTx;
}

function signTest() {
  const signer = "0xE20cF871f1646d8651ee9dC95AAB1d93160b3467";
  const privateKey =
    "7c71142c72a019568cf848ac7b805d21f2e0fd8bc341e8314580de11c6a397bf";
  const hash =
    "277127eb342cc6c04df0eaadc99e5311b5d716f4ada512de3d150ef9d253fac3";
  const signature = sign2(signer, privateKey, Buffer.from(hash, "hex"));
  console.log("signature:", signature);
}

function recoverSignature(signer: string, hash: string, signature: string) {
  const message = Buffer.from(hash, "hex");
  const verifyRes = verifySignature(signer, message, signature);
  console.log("verifyRes:", verifyRes);
}

async function queryWallet(walletAddr: string) {
  const wallet = await attachWallet(walletAddr);
  const data = await wallet.wallet();
  console.log("wallet data:", data);

  const guardians = await wallet.getGuardians(true);
  console.log("guardians:", guardians);
}

async function signRecoverTest(walletAddr: string) {
  const wallet = await attachWallet(walletAddr);
  const masterCopy = await wallet.getMasterCopy();

  const validUntil = new BN("6130c75e", 16);
  const newOwner = "0x2EfC7EFa9b179b4a176e2418E63B53c66A8A8c9C";
  const guardians = ["0xd5535729714618E57C42a072B8d56E72517f3800"];
  const signer = "0xE20cF871f1646d8651ee9dC95AAB1d93160b3467";
  const privateKey =
    "7c71142c72a019568cf848ac7b805d21f2e0fd8bc341e8314580de11c6a397bf";

  const signRes = signRecover(
    masterCopy,
    walletAddr,
    validUntil,
    newOwner,
    guardians,
    signer,
    privateKey
  );
  console.log("signRes:", signRes);
}

async function signMetaTxTest(inputData: string) {
  const walletAddr = "0x0dfa9b2ab43b881430b6f52122618cc6b8f3a2c9";
  const wallet = await attachWallet(walletAddr);
  const masterCopy = await wallet.getMasterCopy();
  console.log("masterCopy:", masterCopy);
  const sender = "0xb259d7f2042b168c60fd5593d1a84327581dd89e";
  const dataParsed = (await decodeWalletInput(inputData)).args;
  console.log("dataParsed:", dataParsed);

  const metaTx: MetaTx = {
    to: dataParsed.to,
    nonce: dataParsed.nonce,
    gasToken: dataParsed.gasToken,
    gasPrice: dataParsed.gasPrice,
    gasLimit: dataParsed.gasLimit,
    gasOverhead: dataParsed.gasOverhead,
    feeRecipient: dataParsed.feeRecipient,
    requiresSuccess: dataParsed.requiresSuccess,
    data: Buffer.from(dataParsed.data.slice(2), "hex"),
    signature: Buffer.from(dataParsed.signature.slice(2), "hex"),
    approvedHash: Buffer.from(dataParsed.approvedHash.slice(2), "hex")
  };

  console.log("metaTx:", metaTx);
  signMetaTx(masterCopy, metaTx, "");
}

async function main() {
  // await signMetaTxTest();
  // await decodeResult();

  // await decodeWalletFactoryInput(
  //   "0xd92d1f5600000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e20cf871f1646d8651ee9dc95aab1d93160b34670000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000017b5dc97cfc000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000042e58444e3f0638209443306de7cc6cf89ba107939b191cbd407e7422eef1830eb6c118a3592c5dc53966573b52f24b32d476e36e948bf19aa209a9873e3bc9d4b1c02000000000000000000000000000000000000000000000000000000000000"
  // );

  // await decodeMetaTx(
  //   "0x09779927000000000000000000000000f9bd8230650e9a956a7003f211c1fd6e0884ee160000000000000000000000000000000000000000000000000000017be7bec2010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000edee915ae45cc4b2fdd1ce12a2f70dca0b2ad9e500000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000028000000000000000000000000000000000000000000000000000000000000001042e9feb790000000000000000000000000baba1ad5be3a5c0a66e7ac838a129bf948f1ea40000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000044d59acd25000000000000000000000000f9bd8230650e9a956a7003f211c1fd6e0884ee1631062154e712224164f51d1eb7d4b173ce9cf017aab0db00ba5068f10f523770000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000428a7872f8cd82f511fae63e754c6554c970a3b9de5ea82f13fb62e6a213b53a0815e818fd5c0347867a8e6f021a94f0494a3aafb55f76f184ce3e0044fafc8caa1b02000000000000000000000000000000000000000000000000000000000000"
  // );

  decodeWithABI(
    '[{"inputs":[{"internalType":"contract IUniswapV2Factory","name":"_factory","type":"address"},{"internalType":"address","name":"_wethAddress","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"tokenValue","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}]',
    "0xf18217830000000000000000000000000baba1ad5be3a5c0a66e7ac838a129bf948f1ea40000000000000000000000000000000000000000000000000de0b6b3a7640000"
  );

  // signTest();
  // recoverSignature(
  //   "0xE20cF871f1646d8651ee9dC95AAB1d93160b3467",
  //   "c9ecfa8e66fa911194162c10f692db3e51f811844cac91031ea5fa67ad696aa3",
  //   "7b59b301e99209dd96e9a07d1328dfd9625fb33b6de34187f4bb4e0677e39d36692db8d37812bdd9f20e45000a0d9241df2412f6be8d555d1929f571857ae7491b02"
  // );

  // await verifySignatureERC1271(
  //   "0xd5535729714618e57c42a072b8d56e72517f3800",
  //   "0x3a329c1df88e5325109f0a7be8dc2119c38466c404fade7f16cb358e263f0438",
  //   "0x0f848532626308db147721ddb0e4c06c8403ed2d22f7048e950ad34c6cb04a8a05b0657172344fb1e5dab4abac62edf9a04780baee2755b2455d77942da393721b02"
  // );

  // await queryWallet("0xC238C9f6E0D73F7e16632430BC0Af758c9c5184D");

  // await walletERC1271Test(
  //   "0xacba35c89046f6083bbd6bf6d6e88b438c9b1a1b",
  //   "",
  //   ""
  // );

  // await signRecoverTest("0xAcba35C89046F6083bbd6bF6D6E88B438c9B1A1b");
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
