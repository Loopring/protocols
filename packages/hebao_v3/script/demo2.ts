import { ethers } from "hardhat";

// import { BigNumber } from 'ethers'
// import { ethers } from 'hardhat'

// import { getUserOpHash } from '../test/helper/AASigner'
// import { simulationResultCatch } from '../test/helper/utils'

import {
  EntryPoint__factory,
  SmartWalletV3__factory,
  WalletFactory__factory,
  DelayedImplementationManager__factory,
  VerifyingPaymaster__factory,
} from "./../typechain-types";
import { simulationResultCatch } from "../test/helper/utils";

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  console.log(chainId);
  // const smartWallet = SmartWalletV3__factory.connect('0x44e7527ab6cFeB896e53e1F45B6177E81FC985a8', ethers.provider);
  // console.log(await smartWallet.entryPoint());
  // console.log(await smartWallet.getOwner());
  // console.log(await smartWallet.getGuardians(true));
  // const signers = await ethers.getSigners();
  // const deployer = signers[0];
  // const signedUserOp = {
  // "callData": "0xf1b43ae400000000000000000000000000000000ffffffffffffffffffffffffffffffff",
  // "callGasLimit": "0xffffff",
  // "initCode": "0x",
  // "maxFeePerGas": "0xff",
  // "maxPriorityFeePerGas": "0xff",
  // "nonce": "0x18cd3fc7892",
  // "paymasterAndData": "0x",
  // "sender": "0x130c3ff0dc0e7a4e8d4d3fceb931e300dd5012f9",
  // "signature": "0x46dfe99e814630028a84dae42e3aaf09f3317d2ed31e9b38f39d626b43793efe6fee3f00a10b871cd4b17bdd748cc9113e08dd0b6a1221df341888c06bc5248d1c",
  // }
  // const signedUserOp = {
  // callData:
  // "0xb9806d99000000000000000000000000ae404c050c3da571afefcff5b6a64af451584000000000000000000000000000bf6674dcbd17bac9d9713c767ca8c52451aa11d70000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000023078000000000000000000000000000000000000000000000000000000000000",
  // callGasLimit: "0xffffff",
  // initCode: "0x",
  // maxFeePerGas: "0xff",
  // maxPriorityFeePerGas: "0xff",
  // metaTxType: 0,
  // nonce: "0x18cd2a9072d",
  // paymasterAndData: "0x",
  // preVerificationGas: "0xffffff",
  // sender: "0x937234ebd31397c4e55ee4c6704614dcec7a1ce6",
  // signature: "0x" + "00".repeat(66),
  // verificationGasLimit: "0xffffff",
  // };
  // const userOp = {
  // // default values for missing fields.
  // paymasterAndData: "0x",
  // maxFeePerGas: 0,
  // maxPriorityFeePerGas: 0,
  // preVerificationGas: 0,
  // verificationGasLimit: 10e6,
  // ...signedUserOp,
  // };
  // const entryPoint = EntryPoint__factory.connect(
  // "0xe6ac2E178d07A857427a3B6744606AdCaA891e5c",
  // deployer
  // );
  // const errorResult = await entryPoint.callStatic
  // .simulateValidation(userOp)
  // .catch((e) => e);
  // if (errorResult.errorName !== 'ValidationResult') {
  // throw errorResult
  // }
  // const { returnInfo } = errorResult.errorArgs;
  // console.log(returnInfo);
  // const { preOpGas, validAfter, validUntil } = returnInfo;
  // console.log(preOpGas);
  // await entryPoint.depositTo('0x3aC7DE80fBDC7E17FEEEc12CFCd3b21B998b61a1', {value: ethers.utils.parseEther('0.01')});
  // const gas = await ethers.provider.estimateGas({
  // from: '0xe6ac2E178d07A857427a3B6744606AdCaA891e5c',
  // to: '0x0b29fcbdd9dbd900ffa9bd7b43919fc76df010a6',
  // data: '0x2e9feb790000000000000000000000006e399e6540242d4e08bec3b6a93e7f06380568ce0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004f83d08ba00000000000000000000000000000000000000000000000000000000'
  // })
  // console.log(gas)
  // const data =
  // SmartWalletV3__factory.createInterface().decodeFunctionData(
  // 'callContract',
  // '0x2e9feb790000000000000000000000006e399e6540242d4e08bec3b6a93e7f06380568ce0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004f83d08ba00000000000000000000000000000000000000000000000000000000'
  // )
  // console.log(data)
  // const contract = new ethers.Contract(
  // '0x5b5fbb2f52fff9d5c9f772923b2e0444f22012dc',
  // [
  // 'function supportsInterface(bytes4 interfaceID) view returns (bool)',
  // 'function balanceOfBatch(address[] calldata accounts,uint256[] calldata ids) external view returns (uint256[] memory)',
  // 'function uri(uint256 id) external view returns (string memory)',
  // 'function balanceOf(address account, uint256 id) external view returns (uint256)'
  // ],
  // ethers.provider
  // )
  // const flag = await contract.supportsInterface('0xd9b67a26')
  // console.log(await contract.uri(0))
  // const balance = await contract.balanceOfBatch(
  // ['0x152356d19068c0f65cab4ecb759236bb0865a932'],
  // [123]
  // )
  // // const balance = await contract.balanceOf('0x5b5fbb2f52fff9d5c9f772923b2e0444f22012dc', 123);
  // console.log(balance)
  // console.log(flag)
  // const str =
  // '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000044661696c00000000000000000000000000000000000000000000000000000000'
  // console.log(ethers.utils.defaultAbiCoder.decode(['string'], str))
  // const smartWallet = SmartWalletV3__factory.connect('0x130c3ff0dc0e7a4e8d4d3fceb931e300dd5012f9', ethers.provider);
  // console.log(await smartWallet.entryPoint());
  // const signers = await ethers.getSigners()
  // const deployer = signers[0]
  // const paymaster = VerifyingPaymaster__factory.connect(
  // '0xC71B4d08B838e8525CA07Ac3d0C763152a3448A1',
  // deployer
  // )
  // await (
  // await paymaster.addToken(
  // '0xae404c050c3da571afefcff5b6a64af451584000'
  // )
  // ).wait()
  // const walletFactory = WalletFactory__factory.connect('0x25E0D9d529CE7c6640F853d2455adA3d463D759f', deployer);
  // console.log(await walletFactory.walletImplementation());
  // const implStorage = DelayedImplementationManager__factory.connect('0xE7292d4A4c9D3922455a08F0DF99c3a0b0A98B3E', deployer);
  // const impl = await implStorage.currImpl();
  // console.log(impl);
  // implStorage.delayedUpgradeTo();
  // for(const operator of ['0xd465F61eB0c067e648B81e43f97af8cCD54b3D17', '0x3435259218bf656186F123B6d9129BF8D19c2941', '0xf6C53560E79857ce12DdE54782d487B743b70717']){
  // if(await walletFactory.isOperator(operator)){
  // console.log(`${operator} is added already`);
  // continue;
  // }
  // await (await walletFactory.addOperator(operator)).wait();
  // }
  // const rpcUrl = 'http://13.58.247.142:3000/rpc'
  // // const rpcUrl = 'https://goerli.infura.io/v3/618d99659b2641cb852a1477eba61790'
  // const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  // const network = await provider.getNetwork();
  // const entryPointAddr = '0xe6ac2E178d07A857427a3B6744606AdCaA891e5c';
  // const entryPoint = EntryPoint__factory.connect(entryPointAddr, deployer);
  // const userOp = {"initCode":"0x","sender":"0x130c3ff0dc0e7a4e8d4d3fceb931e300dd5012f9","nonce":"0x018beadb8df7","callData":"0xb9806d9900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003b9aca0000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000","callGasLimit":"0xe3f2","verificationGasLimit":"0xef47","preVerificationGas":"0xb96f","maxFeePerGas":"0x34","maxPriorityFeePerGas":"0xc","paymasterAndData":"0x0000000000000000000000000000000000000000","signature":"0xaf9c0c02e66fad6f0731a4f4db0549e42ce592f85f4d89c787a87123941944fe3026ebd5fe047c2f62d0496ee48ad1d6ab10fb5e8ba9c097aae7c843f4c2aca31c"};
  // const userOp2 = {
  // ...userOp,
  // paymasterAndData: '0x',
  // maxFeePerGas: 0,
  // maxPriorityFeePerGas: 0,
  // preVerificationGas: 0,
  // verificationGasLimit: 10e6
  // }
  // const result = await entryPoint.callStatic.simulateValidation(userOp2).catch(simulationResultCatch);
  // console.log(result);
  // console.log(entryPoint.interface.decodeErrorResult('UserOperationRevertReason', '0x0000000000000000000000000000000000000000000000000000018c1640fa0d0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000006408c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000105452414e534645525f4641494c5552450000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'));
  // console.log(ethers.utils.defaultAbiCoder.decode(['string'], '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000105452414E534645525F4641494C55524500000000000000000000000000000000'));

  // const bundlerProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
  // const gas = await bundlerProvider
  // .send('eth_estimateUserOperationGas', [userOp2, entryPointAddr])
  // console.log(gas);
  // const lastBlock = await provider.getBlockNumber()-200000;
  // console.log(lastBlock);
  // const events = await entryPoint.queryFilter(entryPoint.filters.UserOperationEvent('0x340B8210C402810E0EF44723DC9E22A33454DEC968BC89582738071C5F34771D'), lastBlock);
  // // const events = await entryPoint.queryFilter({address: entryPoint.address}, lastBlock);
  // console.log(events)
}

main();
