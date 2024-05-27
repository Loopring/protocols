import { ethers } from 'hardhat'
import {
  EntryPoint__factory,
  SmartWalletV3__factory,
  LoopringPaymaster__factory
} from './../typechain-types'
import * as hre from 'hardhat'
import deploymentJson from '../deployments/deployments.json'

async function main(): Promise<void> {
  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const userop = {
    callData:
      '0xff06ff56000000000000000000000000ae404c050c3da571afefcff5b6a64af4515840000000000000000000000000007027c780771f4d13d59c179a868aa5269bc0d09c0000000000000000000000000000000000000000ffffffffffffffffffffffff0000000000000000000000000000000000000000000000000000000000000000',
    callGasLimit: '0x17a8b',
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    hash: '0x2fb1e48ad4c112d5c31178955d24fe565e640c300750356f7f5c61f44b50f916',
    initCode: '0x',
    maxFeePerGas: '0x1d80',
    maxPriorityFeePerGas: '0x1143',
    metaTxType: 0,
    nonce: '0x2',
    paymasterAndData:
      '0x7027c780771f4d13d59c179a868aa5269bc0d09c0000000000000000000000001fea9801725853622c33a23a86251e7c81898b250000000000000000000000000000000000000000000000000098567b0884fe330000000000000000000000000000000000000000000000000000000065c20d3c00000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000041c3f2a7b267970ac8e8e91cbcedbc4421a189fbbc14856da752d99e1abd8831a04356f155be2d7b7a594db69d8833861ecd5b64e6f30ae6af24b87d046a0c2aa01b00000000000000000000000000000000000000000000000000000000000000',
    preVerificationGas: '0xba9f',
    sender: '0x7f2ea42a321240087220584dcc1c65afbdfbd811',
    signature:
      '0xc0205ed0c79a734105adea6aef3aace5d6e951f8ee39afd34fefac967c1ca862469bab7832155794484716bb4793fc15c22dc8899afb5ad9b0ec52839de4b64d1c',
    verificationGasLimit: '0x22501'
  }

  // const userop = {
  // callData:
  // '0xb9806d99000000000000000000000000d69d3e64d71844bbdda51cd7f23ed3631e9fac490000000000000000000000008686c21ff9ae737ce331479c3af00468a4998ba30000000000000000000000000000000000000000000000004563918244f4000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000023078000000000000000000000000000000000000000000000000000000000000',
  // callGasLimit: '0x16769',
  // entryPoint: '0x779eEcA2315a44D20806217c005731aE7DDB5ca0',
  // hash: '0x244d0acf339bf7e6d501f08abab302fcf99ee4a7f3635b842c2f24076958377d',
  // initCode: '0x',
  // maxFeePerGas: '0x98968001',
  // maxPriorityFeePerGas: '0x59682f00',
  // metaTxType: 0,
  // nonce: '0x18d05fd87e2',
  // paymasterAndData:
  // '0x9ca6ffc3cc53a50c7322ab7b70fd413c49a55bfd000000000000000000000000d69d3e64d71844bbdda51cd7f23ed3631e9fac49000000000000000000000000000000000000000000000000000000000000989b0000000000000000000000000000000000000000000000000000000065a361670000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000004170ea418b2e715a952508948f0e07b7fca36fb16600659a6cdc6e66da481c1fb14d2a5a2ab8e301c204d180ceffd8ff2b83743dd8a9fe4ee8a04baf43ab63f69c1c00000000000000000000000000000000000000000000000000000000000000',
  // preVerificationGas: '0xbc87',
  // sender: '0xa45781f336f5f0ef24fda58089db59b47b922b59',
  // signature:
  // '0x4da29a0cd3ee263b40966aa7dca0287e17d53abe5a875eb5183c1223acd937183242d531ce57b9130ae869ab66829eda74de8a9ecca1b92926004ba5e74e2b361b',
  // verificationGasLimit: '0x22661'
  // }

  const smartWallet = SmartWalletV3__factory.connect(
    userop.sender,
    ethers.provider
  )
  const smartWalletOwner = await smartWallet.getOwner()
  const paymasterAddr =
    deploymentJson[hre.network.name].LoopringPaymaster
  const paymaster = LoopringPaymaster__factory.connect(
    paymasterAddr,
    deployer
  )
  // const operator = '0xE6FDa200797a5B8116e69812344cE7D2A9F17B0B'
  // const role = await paymaster.SIGNER()
  // const isOperator = await paymaster.hasRole(role, operator)
  // if (!isOperator) {
  // throw new Error(`address: ${operator} is not a valid operator`)
  // }
  console.log(
    ethers.utils.defaultAbiCoder.encode(
      ['uint48', 'uint48'],
      [12, 12]
    ).length
  )
  const result = ethers.utils.defaultAbiCoder.decode(
    ['address', 'uint48', 'uint256', 'bytes'],
    ethers.utils.hexDataSlice(userop.paymasterAndData, 20)
  )
  // token, valueOfEth, validUntil, signature
  const packedData = ethers.utils.solidityPack(
    ['address', 'uint256', 'uint256'],
    [result[0], result[1], result[2]]
  )
  const hash = await paymaster.getHash(userop, packedData)
  // check paymaster signature
  // console.log('paymaster operator: ', operator)
  console.log(
    'paymaster signer: ',
    ethers.utils.verifyMessage(ethers.utils.arrayify(hash), result[3])
  )

  // check wallet owner signature
  const entryPointAddr = '0x779eEcA2315a44D20806217c005731aE7DDB5ca0'
  const entryPoint = EntryPoint__factory.connect(
    entryPointAddr,
    ethers.provider
  )
  const userOpHash = await entryPoint.getUserOpHash(userop)
  console.log('smart wallet owner: ', smartWalletOwner)
  console.log(
    'smart wallet signer: ',
    ethers.utils.verifyMessage(
      ethers.utils.arrayify(userOpHash),
      userop.signature
    )
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
