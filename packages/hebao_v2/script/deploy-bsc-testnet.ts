const hre = require("hardhat");
const ethers = hre.ethers;
import {
  newWalletImpl,
  newWalletFactoryContract
} from "../test/commons";
import { signCreateWallet } from "../test/helper/signatureUtils";
import BN = require("bn.js");

async function newWallet() {
  const smartWalletAddress = "0xE708Cb725D6F2aDeEab2258262Aa9129D2A28312";
  const walletFactoryAddress = "0x5Dd70df24364DC05D46C8F40611BFDd107927263";

  const ownerAccount = (await ethers.getSigners())[0];
  const ownerAddr = await ownerAccount.getAddress();
  const fakeGuardian1 = "0x" + "12".repeat(20);
  const salt = 1;
  const signature = signCreateWallet(
    walletFactoryAddress,
    ownerAddr,
    [fakeGuardian1],
    new BN(0),
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
    new BN(0),
    salt
  );
  const walletConfig: any = {
    owner: ownerAddr,
    guardians: [fakeGuardian1],
    quota: 0,
    inheritor: ethers.constants.AddressZero,
    feeRecipient: ethers.constants.AddressZero,
    feeToken: ethers.constants.AddressZero,
    feeAmount: 0,
    signature: Buffer.from(signature.txSignature.slice(2), "hex")
  };

  const walletFactory = await (await ethers.getContractFactory(
    "WalletFactory"
  )).attach(walletFactoryAddress);

  const walletAddrComputed = await walletFactory.computeWalletAddress(
    ownerAddr,
    salt
  );
  console.log("walletAddrcomputed:", walletAddrComputed);

  const tx = await walletFactory.createWallet(walletConfig, salt, { gasLimit:10000000 });
  console.log("tx:", tx);
  const receipt = await tx.wait();
  console.log("receipt:", receipt);
}

async function newWalletFactory() {
  const walletFactory = await newWalletFactoryContract();
  console.log("walletFactory:", walletFactory.address);
}

// run with: npx hardhat run --network arbitrum scripts/deploy-arbitrum.ts
async function main() {
  // await newWalletFactory();

  // success tx:
  // https://testnet.bscscan.com/tx/0x9ab2028456c3e432cfb4ee63997b07716b757d9c215e4e96651674b74e473f7c
  await newWallet();
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
