import { ethers } from "hardhat";
import { deployTask } from "../utils/deploy_util";
import { Contract } from 'ethers'
import { ExchangeV3 } from '../../typechain-types';

async function deployAndRegisterTokens(exchange: ExchangeV3, deployResults: Record<string, string>) {
    const tasks = [
        {
            contractName: 'WETH'
        },
        {
            contractName: 'TEST'
        },
        {
            contractName: 'REP'
        }
    ]

    await deployTask(tasks, deployResults);
    const tokens: string[] = [deployResults['WETH'], deployResults['TEST'], deployResults['REP']]
    for(const token of tokens) {
        await exchange.registerToken(token);
    }
    return deployResults
}

export async function deployExchangeFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();
    const tasks = [
      {
        contractName: "BlockVerifier"
      },
      {
        verifiedName: "contracts/test/tokens/LRC.sol:LRC",
        contractName: "LRC" // need solidity 0.5.7
      },
      {
        contractName: "ProtocolFeeVault",
        args: [">>>LRC"]
      },
      {
        contractName: "AgentRegistry"
      },
      {
        contractName: "LoopringV3",
        args: [">>>LRC", ">>>ProtocolFeeVault", ">>>BlockVerifier"]
      },
      {
        contractName: "ExchangeDeposits"
      },
      {
        contractName: "ExchangeBalances"
      },
      {
        contractName: "ExchangeAdmins"
      },
      {
        contractName: "ExchangeSignatures"
      },
      {
        contractName: "ExchangeMode"
      },
      {
        contractName: "ExchangeTokens"
      },
      {
        contractName: "ExchangeWithdrawals",
        libs: ["ExchangeBalances", "ExchangeTokens"]
      },
      {
        contractName: "ExchangeGenesis",
        libs: ["ExchangeTokens"]
      },
      {
        contractName: "ExchangeBlocks",
        libs: ["ExchangeWithdrawals"]
      },
      {
        contractName: "ExchangeV3",
        libs: [
          "ExchangeDeposits",
          "ExchangeAdmins",
          "ExchangeBlocks",
          "ExchangeTokens",
          "ExchangeGenesis",
          "ExchangeWithdrawals",
          "ExchangeSignatures",
          "ExchangeMode"
        ]
      },
      {
        key: "new-exchange",
        contractName: "OwnedUpgradabilityProxy"
      },
      {
        key: "depositContract",
        contractName: "OwnedUpgradabilityProxy"
      },
      {
        contractName: "DefaultDepositContract"
      },
      {
        contractName: "LoopringIOExchangeOwner",
        args: [">>>new-exchange"]
      }
    ];

    const deployResults: Record<string, string> = {};
    await deployTask(tasks, deployResults);
    const proxy = await ethers.getContractAt(
      "OwnedUpgradabilityProxy",
      deployResults["new-exchange"]
    );
    const exchange = await ethers.getContractAt("ExchangeV3", proxy.address);

    const emptyMerkleRoot =
      "0x1efe4f31c90f89eb9b139426a95e5e87f6e0c9e8dab9ddf295e3f9d651f54698";

    const loopringV3 = await ethers.getContractAt(
      "LoopringV3",
      deployResults["LoopringV3"]
    );

    const data = exchange.interface.encodeFunctionData("initialize", [
      loopringV3.address,
      owner.address,
      emptyMerkleRoot
    ]);
    await (
      await proxy.upgradeToAndCall(deployResults["ExchangeV3"], data)
    ).wait();

    // depositor contract
    // Create the proxy contract for the exchange using the implementation
    const depositContractProxy = await ethers.getContractAt(
      "OwnedUpgradabilityProxy",
      deployResults["depositContract"]
    );
    await depositContractProxy.upgradeTo(
      deployResults["DefaultDepositContract"]
    );
    const depositContract = await ethers.getContractAt(
      "DefaultDepositContract",
      depositContractProxy.address
    );
    // Initialize the deposit contract
    await depositContract.initialize(exchange.address);

    // Set the deposit contract on the exchange
    await exchange.setDepositContract(depositContract.address);

    const blockVerifier = await ethers.getContractAt(
      "BlockVerifier",
      deployResults["BlockVerifier"]
    );

    const protocolFeeVault = await ethers.getContractAt(
      "ProtocolFeeVault",
      deployResults["ProtocolFeeVault"]
    );


    // register token
    await deployAndRegisterTokens(exchange, deployResults);
    const lrc = await ethers.getContractAt("LRC", deployResults['LRC']);
    const weth = await ethers.getContractAt("WETH", deployResults['WETH']);

    return {
      exchange,
      owner,
      otherAccount,
      depositContract,
      loopringV3,
      blockVerifier,
      protocolFeeVault,
      lrc,
      weth
    };
  }
