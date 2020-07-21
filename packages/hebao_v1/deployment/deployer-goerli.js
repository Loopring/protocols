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

function checkCommandArg() {
  if (process.argv.length <= 2) {
    console.log("Usage: \n", process.argv[0], process.argv[1], "RELEASE_DIR");
    process.exit(1);
  } else {
    console.log("deploying simple contracts in ", process.argv[2]);
    return process.argv[2];
  }
}

function getAbiAndBin(releaseDir, contractName) {
  const abi =
    releaseDir +
    "/build/flattened_" +
    contractName +
    "_flat_sol_" +
    contractName +
    ".abi";
  const bin =
    releaseDir +
    "/build/flattened_" +
    contractName +
    "_flat_sol_" +
    contractName +
    ".bin";
  return { abi, bin };
}

async function batchDeploySimpleContracts() {
  const releaseDir = checkCommandArg();

  const targetContractNames = [
    "SignedRequest",
    "WalletRegistryImpl",
    "ModuleRegistryImpl",
    "DappAddressStore",
    "HashStore",
    "NonceStore",
    "QuotaStore",
    "SecurityStore",
    "WhitelistStore",
    "WalletImpl"

    // "ControllerImpl",
    // "OfficialGuardian",
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
    const { abi, bin } = getAbiAndBin(releaseDir, contractName);
    const item = [abi, bin];

    if (contractName === "QuotaStore") {
      item.push("1" + "0".repeat(19)); // default quota: 10 ETH
    }
    deployableItems.push(item);
  }

  const addressFrom = (await web3.eth.getAccounts())[0];
  const txCount = await web3.eth.getTransactionCount(addressFrom);
  deployableItems.forEach(async function(item, i) {
    console.log("deploying:", targetContractNames[i], "nonce:", txCount + i);
    return await doDeploy(txCount, i, item);
  });
}

async function deployController() {
  const releaseDir = checkCommandArg();
  const contractName = "ControllerImpl";
  const { abi, bin } = getAbiAndBin(releaseDir, contractName);

  const moduleRegistryImplAddr = "";
  const walletRegistryImplAddr = "";
  const lockPeriod = "";
  const collectTo = "";
  const ensManager = "";
  const priceOracle = "";

  const deployArgs = [
    abi,
    bin,
    moduleRegistryImplAddr,
    walletRegistryImplAddr,
    lockPeriod,
    collectTo,
    ensManager,
    priceOracle,
    false
  ];

  const addressFrom = (await web3.eth.getAccounts())[0];
  const txCount = await web3.eth.getTransactionCount(addressFrom);
  await doDeploy(txCount, 0, deployArgs);
}

async function deployWalletFactory() {
  const releaseDir = checkCommandArg();
  const contractName = "WalletFactory";
  const { abi, bin } = getAbiAndBin(releaseDir, contractName);

  const controllerImpl = "";
  const walletImpl = "";
  const deployArgs = [abi, bin, controllerImpl, walletImpl, false];

  const addressFrom = (await web3.eth.getAccounts())[0];
  const txCount = await web3.eth.getTransactionCount(addressFrom);
  await doDeploy(txCount, 0, deployArgs);
}

batchDeploySimpleContracts();
