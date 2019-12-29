import { MetaTransaction, getHash } from "./MetaTransaction";
import { SignatureType, batchSign, verifySignatures } from "./Signature";
import BN = require("bn.js");
import fs = require("fs");
const truffleAssert = require("truffle-assertions");

const WalletFactoryModule = artifacts.require("WalletFactoryModule");

contract("WalletFactoryModule", (accounts: string[]) => {
  const owner1 = accounts[0];
  const owner2 = accounts[1];
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  let walletFactoryModule: any;

  const getPrivateKey = (address: string) => {
    const textData = fs.readFileSync("./ganache_account_keys.txt", "ascii");
    const data = JSON.parse(textData);
    return data.private_keys[address.toLowerCase()];
  };

  before(async () => {
    walletFactoryModule = await WalletFactoryModule.deployed();
  });

  it("user should be able to create a wallet himself", async () => {
    const owner = owner1;
    const wallet = await walletFactoryModule.computeWalletAddress(owner);
    const tx = await walletFactoryModule.createWallet(owner, "", []);
    truffleAssert.eventEmitted(tx, "WalletCreated", (event: any) => {
      return event.wallet == wallet && event.owner == owner;
    });
  });

  it("user should be able to create a wallet using a meta tx", async () => {
    const owner = owner2;
    const wallet = await walletFactoryModule.computeWalletAddress(owner);
    const data = walletFactoryModule.contract.methods
      .createWallet(owner, "", [])
      .encodeABI();
    const nonce = (await walletFactoryModule.lastNonce(wallet)).toNumber() + 1;
    const metaTransaction: MetaTransaction = {
      wallet,
      module: walletFactoryModule.address,
      value: 0,
      data,
      nonce,
      gasToken: zeroAddress,
      gasPrice: 0,
      gasLimit: 1000000,
      gasOverhead: 25000,
      feeRecipient: zeroAddress,
      // Don't use this yet: https://github.com/trufflesuite/ganache-core/issues/515
      chainId: /*await web3.eth.net.getId()*/ 1
    };

    const hash = getHash(metaTransaction);
    const signatures = await batchSign(
      [getPrivateKey(owner2)],
      hash,
      SignatureType.EIP_712
    );
    verifySignatures([owner2], hash, signatures);
    const tx = await walletFactoryModule.executeMetaTx(
      metaTransaction,
      signatures
    );
    truffleAssert.eventEmitted(tx, "WalletCreated", (event: any) => {
      return event.wallet == wallet && event.owner == owner;
    });
  });
});
