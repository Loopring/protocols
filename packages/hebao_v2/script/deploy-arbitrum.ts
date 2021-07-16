const hre = require("hardhat");
const ethers = hre.ethers;
import { newWalletImpl, newWalletFactoryContract } from "../test/commons";
import { signCreateWallet } from "../test/helper/signatureUtils";
import BN = require("bn.js");

async function newWallet() {
  // walletFactory and smartWallet contract on test v4:
  // const smartWalletAddress = "0x19F3338C71a16696D27B68DEF0d2fB27Aa4b8807";
  // const walletFactoryAddress = "0x44B74caF7CB28cC243EaA9D1d1b3eCb2Ddc2C9f1";

  // walletFactory and smartWallet contract on test v5:
  // const smartWalletAddress = "0xE708Cb725D6F2aDeEab2258262Aa9129D2A28312";
  // const walletFactoryAddress = "0x5Dd70df24364DC05D46C8F40611BFDd107927263";

  // Arbitrum test:
  const walletFactoryAddress = "0xbB7147F582A1e23bec6570FfDCdD413A5788493a";

  // walletFactory and smartWallet contract on Arbitrum One:
  // const smartWalletAddress = "0xc53Ec1cc77Be1793AfE12A7FA6fE0575960F0c36";
  // const walletFactoryAddress = "0xE23c3fD23fd58C0FEE42455A17d15A24637750f6";

  const ownerAccount = (await ethers.getSigners())[0];
  const ownerAddr = await ownerAccount.getAddress();
  const salt = 1;
  const signature = signCreateWallet(
    walletFactoryAddress,
    ownerAddr,
    [],
    new BN(0),
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
    new BN(0),
    salt
  );
  const walletConfig: any = {
    owner: ownerAddr,
    guardians: [],
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

  const tx = await walletFactory.createWallet(walletConfig, salt, {
    gasLimit: 10000000
  });
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
  // We get the contract to deploy
  // const TestTargetContract = await ethers.getContractFactory("TestTargetContract");
  // const testTargetContract = await TestTargetContract.deploy();
  // console.log("Greeter deployed to:", testTargetContract);

  // const walletImpl = await newWalletImpl();
  // console.log("walletImpl address:", walletImpl.address);
  // await newWalletFactory();

  await newWallet();
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
