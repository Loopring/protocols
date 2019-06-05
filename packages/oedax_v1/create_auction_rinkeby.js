const Web3 = require('web3');
const Tx = require('ethereumjs-tx');
const fs = require("fs");
const web3 = new Web3(new Web3.providers.HttpProvider("https://rinkeby.infura.io/hM4sFGiBdqbnGTxk5YT2"));

const ABIPath = "ABI/version10/";
const oedaxABI = fs.readFileSync(ABIPath + "Oedax.abi", "ascii");
const curveABI = fs.readFileSync(ABIPath + "Curve.abi", "ascii");
const tokenABI = fs.readFileSync(ABIPath + "DummyToken.abi", "ascii");
const auctionABI = fs.readFileSync(ABIPath + "Auction.abi", "ascii");

// test account:
const deployAddr = "0xe20cf871f1646d8651ee9dc95aab1d93160b3467";  // accounts[0]
const deployerPrivKey = "7c71142c72a019568cf848ac7b805d21f2e0fd8bc341e8314580de11c6a397bf";

const oedaxAddress = "0xc87d291C40C9F2754be26391878f715277c134B8";
const curveAddress = "0x44Cd575E35F580b12702127b25421e3128525F2B";
const fooTokenAddress = "0xD0ef9379c783E5783BA499ceBA78734794B67E72";
const barTokenAddress = "0x4FF214811F164dAB1889c83b1fe2c8c27d3dB615";

// const OedaxContract = new web3.eth.Contract(JSON.parse(oedaxABI));
// const CurveContract = new web3.eth.Contract(JSON.parse(curveABI));
// const TokenContract = new web3.eth.Contract(JSON.parse(tokenABI));
// const AuctionContract = new web3.eth.Contract(JSON.parse(auctionABI));

const oedaxInstance = new web3.eth.Contract(JSON.parse(oedaxABI), oedaxAddress);
const curveInstance = new web3.eth.Contract(JSON.parse(curveABI), curveAddress);
const fooToken = new web3.eth.Contract(JSON.parse(tokenABI), fooTokenAddress);
const barToken = new web3.eth.Contract(JSON.parse(tokenABI), barTokenAddress);

const feeRecipient = "0xc0ff3f78529ab90f765406f7234ce0f2b1ed69ee"; // accounts[1]
const bidder1 = "0x611db73454c27e07281d2317aa088f9918321415"; // accounts[2]
const bidder2 = "0x23a51c5f860527f971d0587d130c64536256040d"; // accounts[3]
const bidder1PrivKey = "04b9e9d7c1385c581bab12600834f4f90c6e19142faae6c2de670bfb4b5a08c4";
const bidder2PrivKey = "a99a8d27d06380565d1cf6c71974e7707a81676c4e7cb3dad2c43babbdca2d23";

const asker1 = "0xfda769a839da57d88320e683cd20075f8f525a57"; // accounts[4]
const asker2 = "0xf5b3ab72f6e80d79202dbd37400447c11618f21f"; // accounts[5]
const asker1PrivKey = "9fda7156489be5244d8edc3b2dafa6976c14c729d54c21fb6fd193fb72c4de0d";
const asker2PrivKey = "2949899bb4312754e11537e1e2eba03c0298608effeab21620e02a3ef68ea58a";


// sign and send
// @param txData { nonce, gasLimit, gasPrice, to, from, value }
function sendSigned(txData, privKey, cb) {
  const privateKey = new Buffer(privKey, 'hex');
  const transaction = new Tx(txData);
  transaction.sign(privateKey);
  const serializedTx = transaction.serialize().toString('hex');
  console.log("serializedTx:", serializedTx);
  web3.eth.sendSignedTransaction('0x' + serializedTx, cb);
}

async function sendTx(txDataBin, sender, toAddr, privKey, ethVal = "0x0", nonceShift = 0) {
  const addressFrom = sender;
  const txCount = await web3.eth.getTransactionCount(addressFrom);

  const txData = {
    nonce: web3.utils.toHex(txCount + nonceShift),
    gasLimit: web3.utils.toHex(6500000),
    gasPrice: web3.utils.toHex(5e9),
    from: addressFrom,
    to: toAddr,
    data: txDataBin,
    value: ethVal,  // create auction need 1 eth be sended.
  };

  sendSigned(txData, privKey, function(err, result) {
    if (err) {
      console.log(err);
    } else {
      console.log("tx send succeeded!");
    }
  });
}

function numToBN(num) {
  return web3.utils.toBN("0x" + num.toString(16), 16);
}

async function test() {
  // const updateSettingsBin = oedaxInstance.methods.updateSettings(
  //   feeRecipient, curveAddress, 5, 20, 1, 300, 1, 1, 1, 1
  // ).encodeABI();
  // await sendTx(updateSettingsBin, deployAddr, oedaxInstance.address, deployerPrivKey);

  // const setFooTokenRankBin = oedaxInstance.methods.setTokenRank(
  //   fooToken.address, 10).encodeABI();
  // await sendTx(setFooTokenRankBin, deployAddr, oedaxInstance.address, deployerPrivKey);
  // const setBarTokenRankBin = oedaxInstance.methods.setTokenRank(
  //   barToken.address, 100).encodeABI();
  // await sendTx(setBarTokenRankBin, deployAddr, oedaxInstance.address, deployerPrivKey);

  // console.log(fooToken.address, barToken.address);

  // const createAuctionBin1 =  oedaxInstance.methods.createAuction(
  //   fooToken.address, barToken.address, 1, 1, 10, 5, 2, 900, 10800
  // ).encodeABI();
  // await sendTx(createAuctionBin1, deployAddr, oedaxInstance.address, deployerPrivKey, numToBN(1e18));

  // transfer eth to askers and bidders:
  // await sendTx("", deployAddr, asker1, deployerPrivKey, numToBN(5e17));
  // await sendTx("", deployAddr, bidder1, deployerPrivKey, numToBN(5e17));
  // await sendTx("", deployAddr, asker2, deployerPrivKey, numToBN(5e17));
  // await sendTx("", deployAddr, bidder2, deployerPrivKey, numToBN(5e17), 1);

  // const setBalanceBin1 = fooToken.methods.setBalance(asker1, "1000000000000000000000000").encodeABI();
  // await sendTx(setBalanceBin1, asker1, fooToken.address, asker1PrivKey);
  // const approveBin1 = fooToken.methods.approve(oedaxAddress, "1000000000000000000000000").encodeABI();
  // await sendTx(approveBin1, asker1, fooToken.address, asker1PrivKey);

  // const setBalanceBin2 = barToken.methods.setBalance(bidder1, "1000000000000000000000000").encodeABI();
  // await sendTx(setBalanceBin2, bidder1, barToken.address, bidder1PrivKey);

  // const approveBin2 = barToken.methods.approve(oedaxAddress, "1000000000000000000000000").encodeABI();
  // await sendTx(approveBin2, bidder1, barToken.address, bidder1PrivKey);

  /////////////////////////////
  // const setBalanceBin3 = fooToken.methods.setBalance(asker2, "1000000000000000000000000").encodeABI();
  // await sendTx(setBalanceBin3, asker2, fooToken.address, asker2PrivKey);
  // const approveBin3 = fooToken.methods.approve(oedaxAddress, "1000000000000000000000000").encodeABI();
  // await sendTx(approveBin3, asker2, fooToken.address, asker2PrivKey, "", 1);

  // const setBalanceBin4 = barToken.methods.setBalance(bidder2, "1000000000000000000000000").encodeABI();
  // await sendTx(setBalanceBin4, bidder2, barToken.address, bidder2PrivKey);

  // const approveBin4 = barToken.methods.approve(oedaxAddress, "1000000000000000000000000").encodeABI();
  // await sendTx(approveBin4, bidder2, barToken.address, bidder2PrivKey, "", 1);
  ///////////////////////////

  // const auctionAddr1 = "0xbFc90d47B99F6f9d644ab258F101386db0954963";
  // const auctionAddr1 = "0x6826DEC36f51cEa933e29a9f989D41Fb734f1CC6";
  // const auctionAddr1 = "0xca8b8B8a0130E6661901bbda1f1B83EAfcc58CCf";
  const auctionAddr1 = "0x6D498B9CFfAF20cb490304fDf54C228b84c6FCc5";
  const auctionInstance1 = new web3.eth.Contract(JSON.parse(auctionABI), auctionAddr1);

  // Const bidderBarTokenBalance = await barToken.methods.balanceOf(bidder1).call();
  // const bidderBarAllowance = await barToken.methods.allowance(bidder1, oedaxAddress).call();
  // console.log(bidderBarTokenBalance.toString(10), bidderBarAllowance.toString(10));

  // const askBin1 = auctionInstance1.methods.ask("100000").encodeABI();
  // await sendTx(askBin1, asker1, auctionAddr1, asker1PrivKey);

  // const bidBin1 = auctionInstance1.methods.bid("10").encodeABI();
  // await sendTx(bidBin1, bidder1, auctionAddr1, bidder1PrivKey);

  // const askBin2 = auctionInstance1.methods.ask("4000000").encodeABI();
  // await sendTx(askBin2, asker2, auctionAddr1, asker2PrivKey);

  // const bidBin2 = auctionInstance1.methods.bid("500").encodeABI();
  // await sendTx(bidBin2, bidder2, auctionAddr1, bidder2PrivKey);

  // const status1 = await auctionInstance1.methods.getStatus().call();
  // console.log("status1:", status1);

  const settleBin = auctionInstance1.methods.settle().encodeABI();
  await sendTx(settleBin, asker1, auctionAddr1, asker1PrivKey);

}

test();
