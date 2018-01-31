import { BigNumber } from "bignumber.js";
import * as fs from "fs";
import { LoopringSubmitParams, OrderParams } from "../util/types";
import { Order } from "./order";
import { Ring } from "./ring";
import { RingFactory } from "./ring_factory";

var Web3 = require("web3"); // tslint:disable-line
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8546"));

const abi = '[{"constant":true,"inputs":[],"name":"ENTERED_MASK","outputs":[{"name":"","type":"uint64"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"FEE_SELECT_MAX_VALUE","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"MARGIN_SPLIT_PERCENTAGE_BASE","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"ringIndex","outputs":[{"name":"","type":"uint64"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"addresses","type":"address[3]"},{"name":"orderValues","type":"uint256[7]"},{"name":"buyNoMoreThanAmountB","type":"bool"},{"name":"marginSplitPercentage","type":"uint8"},{"name":"v","type":"uint8"},{"name":"r","type":"bytes32"},{"name":"s","type":"bytes32"}],"name":"cancelOrder","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"RATE_RATIO_SCALE","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"lrcTokenAddress","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"bytes32"}],"name":"cancelledOrFilled","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"tokenRegistryAddress","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"delegateAddress","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"addressList","type":"address[2][]"},{"name":"uintArgsList","type":"uint256[7][]"},{"name":"uint8ArgsList","type":"uint8[2][]"},{"name":"buyNoMoreThanAmountBList","type":"bool[]"},{"name":"vList","type":"uint8[]"},{"name":"rList","type":"bytes32[]"},{"name":"sList","type":"bytes32[]"},{"name":"ringminer","type":"address"},{"name":"feeRecipient","type":"address"}],"name":"submitRing","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"maxRingSize","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"ringhashRegistryAddress","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"cutoff","type":"uint256"}],"name":"setCutoff","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"FEE_SELECT_LRC","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"cutoffs","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"rateRatioCVSThreshold","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"FEE_SELECT_MARGIN_SPLIT","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[{"name":"_lrcTokenAddress","type":"address"},{"name":"_tokenRegistryAddress","type":"address"},{"name":"_ringhashRegistryAddress","type":"address"},{"name":"_delegateAddress","type":"address"},{"name":"_maxRingSize","type":"uint256"},{"name":"_rateRatioCVSThreshold","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_ringIndex","type":"uint256"},{"indexed":true,"name":"_ringhash","type":"bytes32"},{"indexed":false,"name":"_miner","type":"address"},{"indexed":false,"name":"_feeRecipient","type":"address"},{"indexed":false,"name":"_isRinghashReserved","type":"bool"},{"indexed":false,"name":"_orderHashList","type":"bytes32[]"},{"indexed":false,"name":"_amountsList","type":"uint256[4][]"}],"name":"RingMined","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_orderHash","type":"bytes32"},{"indexed":false,"name":"_amountCancelled","type":"uint256"}],"name":"OrderCancelled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_address","type":"address"},{"indexed":false,"name":"_cutoff","type":"uint256"}],"name":"CutoffTimestampChanged","type":"event"}]'; // tslint:disable-line

const erc20ABI = '[{"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"from","type":"address"},{"name":"to","type":"address"},{"name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"who","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"owner","type":"address"},{"name":"spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"}]'; // tslint:disable-line

const ProtocolContract = web3.eth.contract(JSON.parse(abi));
const Erc20Contract = web3.eth.contract(JSON.parse(erc20ABI));

const mainnetLoopringAddr = "0xaD111a1D34045dF921259FF91F8096EeC1afD7A9";
const delegateAddr = "0xaf7ef25C997A5121459122308a84A032D4A16868";
const blockTimestamp = 1511572670;

const order1Owner = "0x16a03aa61006b138b680f1dbb1dbdae8ef1389fa";
const order2Owner = "0x6bd5d6fe42419e9039323f9d25b6484f5344f00d";
const order3Owner = "0xc480e8759ee0691e90e4a4ce5391b7af7d22bba8";
const ringOwner = "0x6d4ee35d70ad6331000e370f079ad7df52e75005";

const mainnetEosAddr = "0x86fa049857e0209aa7d9e616f7eb3b3b78ecfdb0";
const mainnetZrxAddr = "0xe41d2489571d322189246dafa5ebde1f4699f498";
const mainnetBnbAddr = "0xb8c77482e45f1f44de1745f52c74426c631bdd52";
const mainnetLrcAddr = "0xEF68e7C694F40c8202821eDF525dE3782458639f";

async function erc20Approve(tokenAddr: string,
                            tokenOwner: string,
                            spender: string,
                            amount: number,
                            decimals: number) {
  const erc20Token = Erc20Contract.at(tokenAddr);
  const realAmount = amount * Math.pow(10, decimals);
  await erc20Token.approve(spender, realAmount, {from: tokenOwner});
}

async function size2Ring01() {
  const orderPrams1 = {
    loopringProtocol: mainnetLoopringAddr,
    tokenS: mainnetEosAddr,
    tokenB: mainnetZrxAddr,
    amountS: new BigNumber(3e18),
    amountB: new BigNumber(8e18),
    validSince: new BigNumber(this.currBlockTimeStamp * 1000),
    validUntil: new BigNumber((this.currBlockTimeStamp + 360000) * 1000),
    lrcFee: new BigNumber(2e18),
    buyNoMoreThanAmountB: true,
    marginSplitPercentage: 55,
  };

  const orderPrams2 = {
    loopringProtocol: mainnetLoopringAddr,
    tokenS: mainnetZrxAddr,
    tokenB: mainnetEosAddr,
    amountS: new BigNumber(8e18),
    amountB: new BigNumber(3e18),
    validSince: new BigNumber(this.currBlockTimeStamp * 1000),
    validUntil: new BigNumber((this.currBlockTimeStamp + 360000) * 1000),
    lrcFee: new BigNumber(15e17),
    buyNoMoreThanAmountB: false,
    marginSplitPercentage: 0,
  };

  const order1 = new Order(order1Owner, orderPrams1);
  const order2 = new Order(order2Owner, orderPrams2);
  order1.web3Instance = web3;
  order2.web3Instance = web3;

  await order1.signAsync();
  await order2.signAsync();

  const ring = new Ring(ringOwner, [order1, order2]);
  ring.web3Instance = web3;
  await ring.signAsync();

  return ring;
}

async function size3Ring01() {

  const orderPrams1 = {
    loopringProtocol: mainnetLoopringAddr,
    tokenS: mainnetEosAddr,
    tokenB: mainnetZrxAddr,
    amountS: new BigNumber(20e18),
    amountB: new BigNumber(60e18),
    validSince: new BigNumber(this.currBlockTimeStamp * 1000),
    validUntil: new BigNumber((this.currBlockTimeStamp + 360000) * 1000),
    lrcFee: new BigNumber(2e18),
    buyNoMoreThanAmountB: true,
    marginSplitPercentage: 55,
  };

  const orderPrams2 = {
    loopringProtocol: mainnetLoopringAddr,
    tokenS: mainnetZrxAddr,
    tokenB: mainnetBnbAddr,
    amountS: new BigNumber(50e18),
    amountB: new BigNumber(10e18),
    validSince: new BigNumber(this.currBlockTimeStamp * 1000),
    validUntil: new BigNumber((this.currBlockTimeStamp + 360000) * 1000),
    lrcFee: new BigNumber(15e17),
    buyNoMoreThanAmountB: false,
    marginSplitPercentage: 0,
  };

  const orderPrams3 = {
    loopringProtocol: mainnetLoopringAddr,
    tokenS: mainnetBnbAddr,
    tokenB: mainnetEosAddr,
    amountS: new BigNumber(10e18),
    amountB: new BigNumber(15e18),
    validSince: new BigNumber(this.currBlockTimeStamp * 1000),
    validUntil: new BigNumber((this.currBlockTimeStamp + 360000) * 1000),
    lrcFee: new BigNumber(25e17),
    buyNoMoreThanAmountB: false,
    marginSplitPercentage: 60,
  };

  const order1 = new Order(order1Owner, orderPrams1);
  const order2 = new Order(order2Owner, orderPrams2);
  const order3 = new Order(order3Owner, orderPrams3);
  order1.web3Instance = web3;
  order2.web3Instance = web3;
  order3.web3Instance = web3;

  await order1.signAsync();
  await order2.signAsync();
  await order3.signAsync();

  const ring = new Ring(ringOwner, [order1, order2, order3]);
  ring.web3Instance = web3;

  await ring.signAsync();

  return ring;
}

async function submit(p: LoopringSubmitParams) {
  const contractInstance = ProtocolContract.at(mainnetLoopringAddr);
  const tx = await contractInstance.submitRing(p.addressList,
                                               p.uintArgsList,
                                               p.uint8ArgsList,
                                               p.buyNoMoreThanAmountBList,
                                               p.vList,
                                               p.rList,
                                               p.sList,
                                               p.ringOwner,
                                               p.feeRecepient,
                                               {from: p.ringOwner, gas: 900000, gasPrice: 5000000000});
  console.log("tx: ", tx);
}

async function approve() {
  await erc20Approve(mainnetEosAddr, order1Owner, delegateAddr, 200, 18);
  await erc20Approve(mainnetZrxAddr, order2Owner, delegateAddr, 200, 18);
  await erc20Approve(mainnetBnbAddr, order3Owner, delegateAddr, 200, 18);

  await erc20Approve(mainnetLrcAddr, order1Owner, delegateAddr, 100, 18);
  await erc20Approve(mainnetLrcAddr, order2Owner, delegateAddr, 100, 18);
  await erc20Approve(mainnetLrcAddr, order3Owner, delegateAddr, 100, 18);
}

async function main() {
  // const ring = await size2Ring01();
  // const feeSelectionList = [0, 0];

  const ring = await size3Ring01();
  const feeSelectionList = [0, 0, 0];

  const ringFactory = new RingFactory("", "", "", "", "", 0);
  const params = ringFactory.ringToSubmitableParams(ring,
                                                    feeSelectionList,
                                                    ring.owner);

  const json = JSON.stringify(params);
  const outFile = "/tmp/ring.json";
  fs.writeFileSync(outFile, json);

  await submit(params);
}

main();

// approve();
