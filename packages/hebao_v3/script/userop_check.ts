import { ethers } from 'hardhat'
import {
  EntryPoint__factory,
  SmartWalletV3__factory,
  LoopringPaymaster__factory,
  OfficialGuardian__factory
} from './../typechain-types'
import * as hre from 'hardhat'
import deploymentJson from '../deployments/deployments.json'
import { type DeploymentType } from './addresses'
import {
  generateMessage,
  type ApprovalOption,
  type Approval,
  ActionType
} from '../test/helper/LoopringGuardianAPI'

const smartWalletImplAddr =
  '0xa08F1Ba8d20B9B418513C7b44d95B400f5d8CEbf'

async function checkApproval(
  userOp: any,
  userOpHash: string,
  owner: string
): Promise<void> {
  const [approval, ownerSignature] =
    ethers.utils.defaultAbiCoder.decode(
      [
        'tuple(address[] signers,bytes[] signatures,uint256 validUntil)',
        'bytes'
      ],
      userOp.signature
    )
  const { signers, signatures, validUntil } = approval as Approval

  // check owner signature
  console.log(
    'check owner signature: ',
    ethers.utils
      .verifyMessage(
        ethers.utils.arrayify(userOpHash),
        ownerSignature
      )
      .toLowerCase() === owner.toLowerCase()
  )

  // check guardians signatures
  const { chainId } = await ethers.provider.getNetwork()

  const calldata = ethers.utils.hexDataSlice(userOp.callData, 4)
  const domain = {
    name: 'LoopringWallet',
    version: '2.0.0',
    chainId,
    verifyingContract: smartWalletImplAddr
  }
  const numSigners = signers.length

  for (let i = 0; i < numSigners; ++i) {
    const approvalOption: ApprovalOption = {
      validUntil,
      action_type: ActionType.TransferToken
    }
    const initValue = {
      wallet: userOp.sender,
      validUntil: approvalOption.validUntil
    }
    const message = generateMessage(
      calldata,
      approvalOption,
      domain,
      initValue
    )
    const expectedSigner = ethers.utils.verifyTypedData(
      message.domain,
      message.types,
      message.value,
      signatures[i]
    )
    if ((await ethers.provider.getCode(signers[i])) !== '0x') {
      // signer can be a smart contract
      // TODO(use EIP1271)
      const officialGuardian = OfficialGuardian__factory.connect(
        signers[i],
        ethers.provider
      )
      console.log(await officialGuardian.isManager(expectedSigner))
    } else {
      console.log(
        expectedSigner.toLowerCase() === signers[i].toLowerCase()
      )
    }
  }
}

async function main(): Promise<void> {
  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const deployment = (
    deploymentJson as Record<string, DeploymentType>
  )[hre.network.name]
  const entryPointAddr = deployment.EntryPoint
  // with approval
  const userop = {
    sender: '0x8e023b3ce7e846e2e8eae978c89dec94766b9328',
    nonce:
      '0x7f4a27a1cc9e2f03d2e40e8f6101a1a55f2a3dca3079b55a0000000000000000',
    initCode: '0x',
    callData:
      '0x8fdbd1760000000000000000000000000000000000000000000000000000000000000000000000000000000000000000557f583c2916fe4f4db2531f5aab9c768121ef5200000000000000000000000000000000000000000000000000038d7ea4c6800000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000',
    callGasLimit: '0xf8a4',
    verificationGasLimit: '0x2fc44',
    preVerificationGas: '0xc96b',
    maxFeePerGas: '0x9faae089',
    maxPriorityFeePerGas: '0xbd2c50e2',
    paymasterAndData: '0x',
    signature:
      '0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000260000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000066212f600000000000000000000000000000000000000000000000000000000000000002000000000000000000000000acd329458ee666c8bab40bb6afca0b0477b6a932000000000000000000000000c94d35ede79da79981842dc79810755d188925f30000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000041a9d360ed6a1224a2dd8ebc1ce4a5f91bfdcbedd2ca6969eb2d5c133bc1c5f2ad4139c2e997dfa9ceae375413887af6b7140d22c96a9f7e0402a9556b0184ccb41b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000041f716c9b731f5cbc0ce7e64458a5c23280a09756b12fcb2f885e8480c71d0e5962a8ea7dbbddc9c275d355716b3cf43157b955ef4ba4ac713157b9d33d08209b81c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004130b334818e9b350c6cb6bee83410588b1612aed01cd8ba5704ce987a83e078de3f1dc9f494d87845e8a2814b7520d63e44c057cbaf9c421d0ab5cbf2bc0ace431b00000000000000000000000000000000000000000000000000000000000000'
  }
  // with paymaster
  // const userop = {
  // callData:
  // '0xff06ff56000000000000000000000000ae404c050c3da571afefcff5b6a64af4515840000000000000000000000000007027c780771f4d13d59c179a868aa5269bc0d09c0000000000000000000000000000000000000000ffffffffffffffffffffffff0000000000000000000000000000000000000000000000000000000000000000',
  // callGasLimit: '0x17a8b',
  // entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  // hash: '0x2fb1e48ad4c112d5c31178955d24fe565e640c300750356f7f5c61f44b50f916',
  // initCode: '0x',
  // maxFeePerGas: '0x1d80',
  // maxPriorityFeePerGas: '0x1143',
  // metaTxType: 0,
  // nonce: '0x2',
  // paymasterAndData:
  // '0x7027c780771f4d13d59c179a868aa5269bc0d09c0000000000000000000000001fea9801725853622c33a23a86251e7c81898b250000000000000000000000000000000000000000000000000098567b0884fe330000000000000000000000000000000000000000000000000000000065c20d3c00000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000041c3f2a7b267970ac8e8e91cbcedbc4421a189fbbc14856da752d99e1abd8831a04356f155be2d7b7a594db69d8833861ecd5b64e6f30ae6af24b87d046a0c2aa01b00000000000000000000000000000000000000000000000000000000000000',
  // preVerificationGas: '0xba9f',
  // sender: '0x7f2ea42a321240087220584dcc1c65afbdfbd811',
  // signature:
  // '0xc0205ed0c79a734105adea6aef3aace5d6e951f8ee39afd34fefac967c1ca862469bab7832155794484716bb4793fc15c22dc8899afb5ad9b0ec52839de4b64d1c',
  // verificationGasLimit: '0x22501'
  // }

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
  const paymasterAddr = deployment.LoopringPaymaster
  const paymaster = LoopringPaymaster__factory.connect(
    paymasterAddr,
    deployer
  )
  const operator = '0xE6FDa200797a5B8116e69812344cE7D2A9F17B0B'
  const role = await paymaster.SIGNER()
  const isOperator = await paymaster.hasRole(role, operator)
  if (!isOperator) {
    throw new Error(`address: ${operator} is not a valid operator`)
  }

  const entryPoint = EntryPoint__factory.connect(
    entryPointAddr,
    ethers.provider
  )
  const userOpHash = await entryPoint.getUserOpHash(userop)
  if (userop.paymasterAndData !== '0x') {
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
      ethers.utils.verifyMessage(
        ethers.utils.arrayify(hash),
        result[3]
      )
    )

    // check wallet owner signature
    console.log('smart wallet owner: ', smartWalletOwner)
    console.log(
      'smart wallet signer: ',
      ethers.utils.verifyMessage(
        ethers.utils.arrayify(userOpHash),
        userop.signature
      )
    )
  }

  await checkApproval(userop, userOpHash, smartWalletOwner)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
