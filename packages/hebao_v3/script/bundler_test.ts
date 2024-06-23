import { entrypointAddr } from 'src/constants'
import { HttpRpcClient } from 'src/bundler_provider'
import { ethers } from 'hardhat'
import { Wallet } from 'ethers'
import { type UserOperation, getUserOpHash } from 'src/aa_utils'

async function sign(
  op2: UserOperation,
  signer: Wallet
): Promise<UserOperation> {
  const { chainId } = await ethers.provider.getNetwork()
  const message = ethers.utils.arrayify(
    getUserOpHash(op2, entrypointAddr, chainId)
  )

  const rawSignature = await signer.signMessage(message)
  const signature = ethers.utils.defaultAbiCoder.encode(
    ['address', 'bytes'],
    [signer.address, rawSignature]
  )
  const signedUserOp = {
    ...op2,
    signature
  }
  return signedUserOp
}

enum VendorType {
  Alchemy,
  StackUp,
  Local
}

function getBundlerUrl(vendor: VendorType): string {
  switch (vendor) {
    case VendorType.Alchemy: {
      const baseUrl = 'https://eth-sepolia.g.alchemy.com/v2'
      const apiKey = 'SNFvRbyJF_p1iea94S-Piy5fqNhALSVB'
      const bundlerUrl = `${baseUrl}/${apiKey}`
      return bundlerUrl
    }
    case VendorType.Local: {
      const bundlerUrl = 'http://0.0.0.0:3000/rpc'
      return bundlerUrl
    }
    case VendorType.StackUp: {
      return 'https://public.stackup.sh/api/v1/node/ethereum-sepolia'
    }
  }
}

async function main(): Promise<void> {
  const bundlerUrl = getBundlerUrl(VendorType.StackUp)
  const { chainId } = await ethers.provider.getNetwork()
  const smartWallet = await ethers.getContractAt(
    'SmartWalletV3',
    '0xD2f1c204F219db1478e8D92728D584e7A51A5235'
  )
  const bundlerProvider = new HttpRpcClient(
    bundlerUrl,
    entrypointAddr,
    chainId
  )
  const nonce = await smartWallet.getNonce()

  const callData = smartWallet.interface.encodeFunctionData(
    'castFromEntryPoint',
    [[], []]
  )
  const smartWalletOwner = new Wallet(
    process.env.PRIVATE_KEY as string,
    ethers.provider
  )
  const signature = ethers.utils.defaultAbiCoder.encode(
    ['address', 'bytes'],
    [
      smartWalletOwner.address,
      '0xe11a1de08db974f0e41457037e28261f190c471a73c489d2a328367398f28c3b4889266e9c9bc08d72f92148079efcd29f637cd4b3b1efdd1d07c9863400d7981b'
    ]
  )
  const feeData = await ethers.provider.getFeeData()

  // const callData = smartWallet.interface.encodeFunctionData('entryPoint')
  const partialUserOp: UserOperation = {
    sender: smartWallet.address,
    nonce,
    callData,
    initCode: '0x', // E: Expected indentation of 6 spaces but found 2.
    maxFeePerGas: feeData.maxFeePerGas!, // E: Expected indentation of 6 spaces but found 2.
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas!, // E: Expected indentation of 6 spaces but found 2.
    paymasterAndData: '0x',
    signature,

    // default value for these fields
    preVerificationGas: 1e6, // E: Expected indentation of 6 spaces but found 2.
    verificationGasLimit: 1e6,
    callGasLimit: 1e6 // E: Expected indentation of 6 spaces but found 2.
  }
  const estimatedGas =
    await bundlerProvider.estimateUserOpGas(partialUserOp)
  const userOp: UserOperation = {
    ...partialUserOp,
    ...estimatedGas,
    preVerificationGas: Math.round(
      estimatedGas.preVerificationGas * 1.1
    )
  }
  const signedUserOp = await sign(userOp, smartWalletOwner)
  try {
    const userOpHash =
      await bundlerProvider.sendUserOpToBundler(signedUserOp)
    const receipt = await bundlerProvider.getUserOpReceipt(userOpHash)
    console.log('reqId', userOpHash, 'txid=', receipt)
  } catch (e: any) {
    console.log(e)
  }
}

main().catch(console.error)
