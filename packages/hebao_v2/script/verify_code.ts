import * as hre from "hardhat";

interface Task {
  args?: string[];
  contractName: string;
}

async function verify_code() {
  const smartWalletImplAddr = "0xdf7E7f110E76449F217e799692eb8EB11B4F5557";

  const deployedResult = {
    WalletFactory: "0xe7d8df8F6546965A59dab007e8709965Efe1255d",
    ForwardProxy: "0x23a19a97A2dA581e3d66Ef5Fd1eeA15024f55611",
    DelayedImplementationManager: "0x93cC2B5ABDa1830E9AcaDE3CB76E22D3082BFAe5",
    LoopringCreate2Deployer: "0x391fD52903D1531fd45F41c4A354533c91289F5F",
  };
  const tasks: Task[] = [
    {
      contractName: "DelayedImplementationManager",
      args: [smartWalletImplAddr],
    },
    {
      contractName: "ForwardProxy",
      args: [deployedResult["DelayedImplementationManager"]],
    },
    {
      contractName: "WalletFactory",
      args: [deployedResult["ForwardProxy"]],
    },
    {
      contractName: "LoopringCreate2Deployer",
    },
  ];

  for (const task of tasks) {
    await hre.run("verify:verify", {
      address: deployedResult[task.contractName],
      constructorArguments: task.args,
    });
  }
}

verify_code();
