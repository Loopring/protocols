// run on arbitrum: npx hardhat run --network arbitrum scripts/deploy-and-setup.ts

import BN = require("bn.js");
const hre = require("hardhat");
const ethers = hre.ethers;
import { newWalletImpl, newWalletFactoryContract } from "../test/commons";
import { signCreateWallet } from "../test/helper/signatureUtils";
import { deployWalletImpl, deployWalletFactory } from "./create2-deploy";

const gasLimit = 7000000;

async function newWallet(walletFactoryAddress: string, _salt?: number) {
    const ownerAccount = (await ethers.getSigners())[0];
    const ownerAddr = await ownerAccount.getAddress();
    const salt = _salt ? _salt : new Date().getTime();
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
        maxFeeAmount: 0,
        salt,
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

    const tx = await walletFactory.createWallet(walletConfig, 0, { gasLimit });
    // console.log("tx:", tx);
    const receipt = await tx.wait();
    console.log("receipt:", receipt);

    return walletAddrComputed;
}

async function newWalletFactory(owner: string) {
    const ERC1271Lib = await (await ethers.getContractFactory(
        "ERC1271Lib"
    )).deploy({gasLimit});
    console.log("ERC1271Lib:", ERC1271Lib.address);

    const ERC20Lib = await (await ethers.getContractFactory("ERC20Lib")).deploy({gasLimit});
    console.log("ERC20Lib:", ERC20Lib.address);

    const GuardianLib = await (await ethers.getContractFactory(
        "GuardianLib"
    )).deploy({gasLimit});
    console.log("GuardianLib:", GuardianLib.address);

    const InheritanceLib = await (await ethers.getContractFactory(
        "InheritanceLib"
    )).deploy({gasLimit});
    console.log("InheritanceLib:", InheritanceLib.address);

    const LockLib = await (await ethers.getContractFactory("LockLib", {
        libraries: {
            GuardianLib: GuardianLib.address
        }
    })).deploy({gasLimit});
    console.log("LockLib:", LockLib.address);

    const MetaTxLib = await (await ethers.getContractFactory("MetaTxLib", {
        libraries: {
            ERC20Lib: ERC20Lib.address
        }
    })).deploy({gasLimit});
    console.log("MetaTxLib:", MetaTxLib.address);

    const QuotaLib = await (await ethers.getContractFactory("QuotaLib")).deploy({gasLimit});
    console.log("QuotaLib:", QuotaLib.address);

    const RecoverLib = await (await ethers.getContractFactory("RecoverLib", {
        libraries: {
            GuardianLib: "0x93363a9215fc02520ccec95dab1a7587449c7451"
        }
    })).deploy({ gasLimit });
    console.log("RecoverLib:", RecoverLib.address);

    const UpgradeLib = await (await ethers.getContractFactory(
        "UpgradeLib"
    )).deploy({gasLimit});
    console.log("UpgradeLib:", UpgradeLib.address);

    const WhitelistLib = await (await ethers.getContractFactory(
        "WhitelistLib"
    )).deploy({gasLimit});
    console.log("WhitelistLib:", WhitelistLib.address);

    const ownerSetter = owner; // goerli
    const priceOracle = "0x" + "00".repeat(20);

    const smartWallet = await (await ethers.getContractFactory("SmartWallet", {
        libraries: {
            ERC1271Lib: ERC1271Lib.address,
            ERC20Lib: ERC20Lib.address,
            GuardianLib: GuardianLib.address,
            InheritanceLib: InheritanceLib.address,
            LockLib: LockLib.address,
            MetaTxLib: MetaTxLib.address,
            QuotaLib: QuotaLib.address,
            RecoverLib: RecoverLib.address,
            UpgradeLib: UpgradeLib.address,
            WhitelistLib: WhitelistLib.address
        }
    })).deploy(priceOracle, ownerSetter, { gasLimit });
    console.log("SmartWallet: ", smartWallet.address);

    const WalletFactory = await (await ethers.getContractFactory(
        "WalletFactory"
    )).deploy(smartWallet.address, { gasLimit });
    console.log("WalletFactory:", WalletFactory.address);

    return await WalletFactory.deployed();
}

async function addManager(contractAddr: string, manager: string) {
    const managableContract = await (await ethers.getContractFactory(
        "OwnerManagable"
    )).attach(contractAddr);
    await managableContract.addManager(manager);

    const isManager = await managableContract.isManager(manager);
    console.log("isManager:", isManager);
}

async function deployPriceOracle() {
    const proxy = await (await ethers.getContractFactory(
        "OwnedUpgradeabilityProxy"
    )).deploy({ gasLimit });
    console.log("priceOracle proxy address:", proxy.address);
}

// [20210729] deployed at arbitrum testnet: 0xd5535729714618E57C42a072B8d56E72517f3800 (proxy)
async function deployOfficialGuardian() {
    const ownerAccount = (await ethers.getSigners())[0];
    const ownerAddr = await ownerAccount.getAddress();

    const proxy = await (await ethers.getContractFactory(
        "OwnedUpgradeabilityProxy"
    )).deploy();
    console.log("officialGuardian proxy address:", proxy.address);

    const officialGuardian = await (await ethers.getContractFactory(
        "OfficialGuardian"
    )).deploy();
    // console.log("officialGuardian address:", officialGuardian.address);

    await proxy.upgradeTo(officialGuardian.address);
    const proxyAsOfficialGuardian = await (await ethers.getContractFactory(
        "OfficialGuardian"
    )).attach(proxy.address);

    console.log("initOwner...");
    await proxyAsOfficialGuardian.initOwner(ownerAddr);
    // await proxyAsOfficialGuardian.addManager(ownerAddr);
    // console.log("add", ownerAddr, "as a manager");

    return proxy.address;
}

async function getWalletImplAddr(walletFactoryAddress: string) {
    const walletFactory = await (await ethers.getContractFactory(
        "WalletFactory"
    )).attach(walletFactoryAddress);

    const masterCopy = await walletFactory.walletImplementation();
    console.log("masterCopy:", masterCopy);
}

async function walletCreationTest() {
    const ownerAccount = (await ethers.getSigners())[0];
    const ownerAddr = await ownerAccount.getAddress();

    const walletFactory = await newWalletFactory(ownerAddr);

    const masterCopy = await walletFactory.walletImplementation();
    console.log("walletFactory:", walletFactory.address);
    console.log("masterCopy:", masterCopy);
    await newWallet(walletFactory.address);

    await getWalletImplAddr(walletFactory.address);
    const officialGuardianAddr = await deployOfficialGuardian();
    await addManager(officialGuardianAddr, ownerAddr);
}

async function create2Test() {
    const smartWalletAddr = await deployWalletImpl();
    // // const walletFactoryAddr = await deployWalletFactory(smartWalletAddr);
    // const walletFactoryAddr = "0x5621a77f8EbC9265A60b0E83B49db998aC046B9C";
    // const newWalletAddr = await newWallet(walletFactoryAddr, 1629366091004);

    // console.log("newWalletAddr:", newWalletAddr);
}

async function main() {
    // await deployPriceOracle();
    await walletCreationTest();
    // await create2Test();

    //await deployOfficialGuardian();
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
