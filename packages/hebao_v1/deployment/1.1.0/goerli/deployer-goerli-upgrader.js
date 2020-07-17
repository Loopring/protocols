const fs = require("fs");
const Web3 = require("web3");
const PrivateKeyProvider = require("truffle-privatekey-provider");
const Tx = require("ethereumjs-tx").Transaction;
// const secureConfig = require('/usr/local/klzhong/private/priv-e391.json');
// const secureConfig = require('/usr/local/klzhong/private/priv-test.json');
// const secureConfig = require('/usr/local/klzhong/private/main-deployer-201904.json');
// const web3 = new Web3(new Web3.providers.HttpProvider("https://rinkeby.infura.io/hM4sFGiBdqbnGTxk5YT2"));

// const provider = new PrivateKeyProvider(secureConfig.privKey, "http://18.162.247.214:8545" /*"https://mainnet.infura.io/v3/a06ed9c6b5424b61beafff27ecc3abf3"*/);
// const web3 = new Web3(new Web3.providers.HttpProvider("https://goerli.infura.io/v3/a06ed9c6b5424b61beafff27ecc3abf3"));
// goerli test network node:
// const web3 = new Web3(new Web3.providers.HttpProvider("http://52.83.60.129:32143"));
// const web3 = new Web3(new Web3.providers.HttpProvider("http://13.231.203.81:8545"));
// const web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:8545"));

const privKey =
  "7c71142c72a019568cf848ac7b805d21f2e0fd8bc341e8314580de11c6a397bf";
const provider = new PrivateKeyProvider(
  privKey,
  "https://goerli.infura.io/v3/a06ed9c6b5424b61beafff27ecc3abf3"
);
const web3 = new Web3(provider);

console.log(process.argv);

// sign and send
// @param txData { nonce, gasLimit, gasPrice, to, from, value }
function sendSigned(txData, cb) {
  const privateKey = new Buffer(privKey, "hex");
  const transaction = new Tx(txData, { chain: "goerli" });
  transaction.sign(privateKey);
  const serializedTx = transaction.serialize().toString("hex");
  console.log("serializedTx:", serializedTx);
  web3.eth.sendSignedTransaction("0x" + serializedTx, cb);
}

async function doDeploy() {
  let contractABI = "";
  let binData = "";
  if (process.argv.length >= 4) {
    contractABI = fs.readFileSync(process.argv[2], "ascii");
    // Notice: binData must startsWith 0x.
    binData = "0x" + fs.readFileSync(process.argv[3], "ascii");
  } else {
    console.log("usage: node deployer abiFile binFile");
  }

  // let args = [];
  // if (process.argv.length > 4) {
  //   // args = process.argv.slice(4);
  //   args.push(process.argv[4]);
  //   args.push([process.argv[5]]);
  //   args.push([]);
  // }
  // console.log("args:", args);

  const addressFrom = (await web3.eth.getAccounts())[0];
  console.log("addressFrom:", addressFrom);
  const myContract = new web3.eth.Contract(JSON.parse(contractABI));

  const txCount = await web3.eth.getTransactionCount(addressFrom);
  const contractBin = myContract
    .deploy({
      data: binData,
      arguments: [
        "0xc5CD7Dd7780d3F7b9ddedC1cbC2B90dBAf833672",
        "0x1008F48E79325a94f4E1FB0f03d713ccB1e4bF32",
        [
          "0x88E25b60Ae57a86A310bED0F1D8967720d6dAee5",
          "0x3d5a09c409b21906F1fFBEa887747ffE93f5522c",
          "0xE268E18bB567Bc5E45869482c87d38683BEDEA12",
          "0x9f29BC9C3b68347c3E21ca1bb0DeB19C8d6D07F4",
          "0xf342Bd37aAA4dBbFF8d25e1F784DDCC0fce9A92A"
        ],
        [
          "0x032E5f3aeaD30c1922DFC4cE76EE586C7dfd94b9",
          "0x6a2459176FA367548533071f55bF20E250C79744",
          "0x801f993d4052b73b31aB0b16fBACd56E34789FC1",
          "0x3F7ABDaa6818A7EA0BFaB9065B4a85ff42F78F89",
          "0x85A9b237192f39Edd6af066c7c0102306a138A76",
          "0x5D4dDe35d19e4CC24Fc0a90E83B6a0e7994ec52D",
          "0x1fe061D8710d300DC96BFb90a740FeDCcd3B7E66",
          "0x8bf3618238934357bDD2d13f5ddA77d05C1743d1"
        ]
      ]
    })
    .encodeABI();

  // console.log("contractBin:", contractBin);

  const txData = {
    nonce: web3.utils.toHex(txCount),
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

doDeploy();
