const fs = require("fs");
const Web3 = require("web3");
const PrivateKeyProvider = require("truffle-privatekey-provider");
const Tx = require("ethereumjs-tx").Transaction;

const privKey =
  "7c71142c72a019568cf848ac7b805d21f2e0fd8bc341e8314580de11c6a397bf";
const provider = new PrivateKeyProvider(
  privKey,
  "https://goerli.infura.io/v3/a06ed9c6b5424b61beafff27ecc3abf3"
);
const web3 = new Web3(provider);

// sign and send
// @param txData { nonce, gasLimit, gasPrice, to, from, value }
function sendSigned(txData, cb) {
  const privateKey = new Buffer(privKey, "hex");
  const transaction = new Tx(txData, { chain: "goerli" });
  transaction.sign(privateKey);
  const serializedTx = transaction.serialize().toString("hex");
  // console.log("serializedTx:", serializedTx);
  web3.eth.sendSignedTransaction("0x" + serializedTx, cb);
}

async function doDeploy(txCount, i, args) {
  const contractABI = fs.readFileSync(args[0], "ascii");
  const binData = "0x" + fs.readFileSync(args[1], "ascii");

  const addressFrom = (await web3.eth.getAccounts())[0];
  // console.log("addressFrom:", addressFrom);
  const myContract = new web3.eth.Contract(JSON.parse(contractABI));

  // const txCount = await web3.eth.getTransactionCount(addressFrom);
  const contractBin = myContract
    .deploy({
      data: binData,
      arguments: args.slice(2)
    })
    .encodeABI();
  // console.log("contractBin:", contractBin);

  const txData = {
    nonce: web3.utils.toHex(txCount + i),
    gasLimit: web3.utils.toHex(8000000),
    gasPrice: web3.utils.toHex(37e9),
    from: addressFrom,
    data: contractBin
  };

  sendSigned(txData, function(err, result) {
    if (err) {
      console.log(err);
    } else {
      console.log("deploy succeeded!");
    }
  });
}

async function batchDeploy() {
  // ../build/flattened_DappAddressStore_flat_sol_DappAddressStore.abi
  const targetContractNames = [
    "SignedRequest",
    "WalletRegistryImpl",
    "ModuleRegistryImpl",
    "DappAddressStore",
    "HashStore",
    "NonceStore",
    "QuotaStore",
    "SecurityStore",
    "WhitelistStore"
    // "ControllerImpl",
    // "OfficialGuardian",
    // "WalletImpl",
    // "WalletFactory",
    // "ERC1271Module",
    // "ForwarderModule",
    // "UpgraderModule",
    // "WhitelistModule",
    // "InheritanceModule",
    // "GuardianModule",
    // "TransferModule"
  ];

  const deployableItems = [];

  for (const contractName of targetContractNames) {
    const abi =
      "../build/flattened_" +
      contractName +
      "_flat_sol_" +
      contractName +
      ".abi";
    const bin =
      "../build/flattened_" +
      contractName +
      "_flat_sol_" +
      contractName +
      ".bin";
    const item = [abi, bin];

    if (contractName === "QuotaStore") {
      item.push("0x" + "00".repeat(20));
    }
    deployableItems.push(item);
  }

  const addressFrom = (await web3.eth.getAccounts())[0];
  const txCount = await web3.eth.getTransactionCount(addressFrom);
  deployableItems.forEach(async function(item, i) {
    console.log("deploying:", targetContractNames[i], i);
    return await doDeploy(txCount, i, item);
  });
}

batchDeploy();
