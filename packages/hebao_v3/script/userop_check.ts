import { ethers } from "hardhat";
import {
  EntryPoint__factory,
  SmartWalletV3__factory,
  VerifyingPaymaster__factory,
} from "./../typechain-types";

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];

  // const userop = {
  // "callData":"0xb9806d99000000000000000000000000d69d3e64d71844bbdda51cd7f23ed3631e9fac490000000000000000000000008686c21ff9ae737ce331479c3af00468a4998ba30000000000000000000000000000000000000000000000004563918244f4000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000023078000000000000000000000000000000000000000000000000000000000000",
  // "callGasLimit":"0x16769",
  // "entryPoint":"0x779eEcA2315a44D20806217c005731aE7DDB5ca0",
  // "hash":"0x244d0acf339bf7e6d501f08abab302fcf99ee4a7f3635b842c2f24076958377d",
  // "initCode":"0x",
  // "maxFeePerGas":"0x98968001",
  // "maxPriorityFeePerGas":"0x59682f00",
  // "metaTxType":0,
  // "nonce":"0x18d05fd87e2",
  // "paymasterAndData":"0x9ca6ffc3cc53a50c7322ab7b70fd413c49a55bfd000000000000000000000000d69d3e64d71844bbdda51cd7f23ed3631e9fac49000000000000000000000000000000000000000000000000000000000000989b0000000000000000000000000000000000000000000000000000000065a361670000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000004170ea418b2e715a952508948f0e07b7fca36fb16600659a6cdc6e66da481c1fb14d2a5a2ab8e301c204d180ceffd8ff2b83743dd8a9fe4ee8a04baf43ab63f69c1c00000000000000000000000000000000000000000000000000000000000000",
  // "preVerificationGas":"0xbc87",
  // "sender":"0xa45781f336f5f0ef24fda58089db59b47b922b59",
  // "signature":"0x4da29a0cd3ee263b40966aa7dca0287e17d53abe5a875eb5183c1223acd937183242d531ce57b9130ae869ab66829eda74de8a9ecca1b92926004ba5e74e2b361b",
  // "verificationGasLimit":"0x22661"
  // }

  const userop = {
    callData:
      "0xb9806d99000000000000000000000000d69d3e64d71844bbdda51cd7f23ed3631e9fac490000000000000000000000008686c21ff9ae737ce331479c3af00468a4998ba30000000000000000000000000000000000000000000000004563918244f4000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000023078000000000000000000000000000000000000000000000000000000000000",
    callGasLimit: "0x16769",
    entryPoint: "0x779eEcA2315a44D20806217c005731aE7DDB5ca0",
    hash: "0xa846066d61982aa368e56e9045be94b3894468da09e346a522599ce00671cb9c",
    initCode: "0x",
    maxFeePerGas: "0x98968001",
    maxPriorityFeePerGas: "0x59682f00",
    metaTxType: 0,
    nonce: "0x18d05fdcf55",
    paymasterAndData:
      "0x9ca6ffc3cc53a50c7322ab7b70fd413c49a55bfd000000000000000000000000d69d3e64d71844bbdda51cd7f23ed3631e9fac49000000000000000000000000000000000000000000000000000000000000988d0000000000000000000000000000000000000000000000000000000065a361790000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000004179d2e49881269f81d3f8316b876245b936fd9c49bd6fafaf814357cd3d801ca569210604438e0b688ed3b766a7fdcdd945626f43db6c8c14b978982beed480411c00000000000000000000000000000000000000000000000000000000000000",
    preVerificationGas: "0xbc87",
    sender: "0xa45781f336f5f0ef24fda58089db59b47b922b59",
    signature:
      "0xe4284bafbbe06b519cfb0640edb2498660538a181b9a442de980c09b6fc40e8a0ea0ef752dd5af256ed5fc6809b16164dd7996568dedf91c03a71c3662aa616f1b",
    verificationGasLimit: "0x22661",
  };

  const smartWallet = SmartWalletV3__factory.connect(
    userop.sender,
    ethers.provider
  );
  const smartWalletOwner = await smartWallet.getOwner();
  const paymasterAddr = "0x9CA6FFC3cC53a50C7322ab7B70fd413C49A55Bfd";
  const paymaster = VerifyingPaymaster__factory.connect(
    paymasterAddr,
    deployer
  );
  const operator = "0xE6FDa200797a5B8116e69812344cE7D2A9F17B0B";
  const role = await paymaster.SIGNER();
  const isOperator = await paymaster.hasRole(role, operator);
  if (!isOperator) {
    throw new Error(`address: ${operator} is not a valid operator`);
  }
  const result = ethers.utils.defaultAbiCoder.decode(
    ["address", "uint256", "uint256", "bytes"],
    ethers.utils.hexDataSlice(userop.paymasterAndData, 20)
  );
  // token, valueOfEth, validUntil, signature
  const packedData = ethers.utils.solidityPack(
    ["address", "uint256", "uint256"],
    [result[0], result[1], result[2]]
  );
  const hash = await paymaster.getHash(userop, packedData);
  // check paymaster signature
  console.log("paymaster operator: ", operator);
  console.log(
    "paymaster signer: ",
    ethers.utils.verifyMessage(hash, result[3])
  );

  // check wallet owner signature
  const chainId = await ethers.provider.getNetwork().then((net) => net.chainId);
  const entryPointAddr = "0x779eEcA2315a44D20806217c005731aE7DDB5ca0";
  const entryPoint = EntryPoint__factory.connect(
    entryPointAddr,
    ethers.provider
  );
  const userOpHash = await entryPoint.getUserOpHash(userop);
  console.log("smart wallet owner: ", smartWalletOwner);
  console.log(
    "smart wallet signer: ",
    ethers.utils.verifyMessage(userOpHash, userop.signature)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
