import { type BytesLike } from '@ethersproject/bytes'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { BigNumber, type BigNumberish, type Wallet } from 'ethers'
import { arrayify } from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import _ from 'lodash'

import { type EntryPoint } from '../typechain-types'

import {
  callDataCost,
  getUserOpHash,
  packUserOp,
  type UserOperation
} from './helper/AASigner'
import { type Approval } from './helper/LoopringGuardianAPI'
import { fixture } from './helper/fixture'
import { simulationResultCatch } from './helper/utils'

describe('verification gaslimit test', () => {
  async function generateApprovals(
    smartWalletOrEOASigners: Array<{
      signer: Wallet
      smartWalletAddress?: string
    }>,
    smartWalletAddr: string,
    verifyingContract: string,
    token: string,
    to: string,
    amount: BigNumberish,
    validUntil: number,
    chainId: number,
    salt: BytesLike
  ): Promise<Approval> {
    // use typedData hash instead
    const types = {
      approveToken: [
        { name: 'wallet', type: 'address' },
        { name: 'validUntil', type: 'uint256' },
        { name: 'token', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'salt', type: 'bytes32' }
      ]
    }

    const domain = {
      name: 'LoopringWallet',
      version: '2.0.0',
      chainId,
      verifyingContract
    }
    const message = {
      types,
      domain,
      primaryType: 'approveToken',
      value: {
        validUntil,
        wallet: smartWalletAddr,
        token,
        to,
        amount,
        salt
      }
    }

    const signatures = await Promise.all(
      smartWalletOrEOASigners.map(async (g) =>
        g.signer._signTypedData(
          message.domain,
          message.types,
          message.value
        )
      )
    )
    const [sortedSigners, sortedSignatures] = _.unzip(
      _.sortBy(
        _.zip(
          smartWalletOrEOASigners.map((g) =>
            g.smartWalletAddress !== undefined
              ? g.smartWalletAddress.toLowerCase()
              : g.signer.address.toLowerCase()
          ),
          signatures
        ),
        (item) => item[0]
      )
    )

    const approval = {
      signers: sortedSigners as string[],
      signatures: sortedSignatures as string[],
      validUntil,
      salt
    }
    return approval
  }

  async function estimateUserOpGas(
    entryPoint: EntryPoint,
    userOp1: UserOperation
  ): Promise<{
    preVerificationGas: BigNumber
    callGasLimit: BigNumber
    verificationGasLimit: BigNumber
  }> {
    const userOp = {
      ...userOp1,
      // default values for missing fields.
      paymasterAndData: '0x',
      maxFeePerGas: 0,
      maxPriorityFeePerGas: 0,
      preVerificationGas: 0,
      verificationGasLimit: 10e6
    }

    const { returnInfo } = await entryPoint.callStatic
      .simulateValidation(userOp)
      .catch(simulationResultCatch)
    const verificationGasLimit = returnInfo.preOpGas

    const callGasLimit = await ethers.provider.estimateGas({
      from: entryPoint.address,
      to: userOp.sender,
      data: userOp.callData
    })
    const rate = BigNumber.from(12)
    const base = 10

    const preVerificationGas = BigNumber.from(
      callDataCost(packUserOp(userOp, false))
    )
    return {
      preVerificationGas: preVerificationGas.mul(rate).div(base),
      callGasLimit: callGasLimit.mul(rate).div(base),
      verificationGasLimit: verificationGasLimit.mul(rate).div(base)
    }
  }

  async function getEIP1559GasPrice(
    maxPriorityFeePerGas1?: BigNumber
  ): Promise<{
    maxPriorityFeePerGas: BigNumber
    maxFeePerGas: BigNumber
  }> {
    const block = await ethers.provider.getBlock('latest')
    const maxPriorityFeePerGas =
      maxPriorityFeePerGas1 ?? BigNumber.from(1e9) // default
    const maxFeePerGas = block.baseFeePerGas!.add(
      maxPriorityFeePerGas
    )
    return {
      maxPriorityFeePerGas,
      maxFeePerGas
    }
  }

  function encodeSignature(
    approval: Approval,
    ownerSignature: string
  ): string {
    const signature = ethers.utils.defaultAbiCoder.encode(
      [
        'tuple(address[] signers,bytes[] signatures,uint256 validUntil,bytes32 salt)',
        'bytes'
      ],
      [approval, ownerSignature]
    )
    return signature
  }

  it('approvals of multiple guardians', async () => {
    const {
      sendUserOp,
      entrypoint,
      smartWalletOwner,
      smartWallet,
      guardians,
      usdtToken,
      deployer,
      smartWalletImpl
    } = await loadFixture(fixture)
    const chainId = await ethers.provider
      .getNetwork()
      .then((net) => net.chainId)

    // use new guardian signature to approve token
    const receiver = deployer.address
    const tokenAmount = ethers.utils.parseUnits('100', 6)
    const validUntil = 0
    const nonce = 0
    // prepare userOp first
    const approveTokenWA =
      await smartWallet.populateTransaction.approveTokenWA(
        usdtToken.address,
        receiver,
        tokenAmount
      )
    // generate approvals of guardian
    const approval = await generateApprovals(
      [
        { signer: smartWalletOwner },
        { signer: guardians[0] },
        { signer: guardians[1] }
      ],
      smartWallet.address,
      smartWalletImpl.address,
      usdtToken.address,
      receiver,
      tokenAmount,
      validUntil,
      chainId,
      ethers.utils.randomBytes(32)
    )
    const gasPriceData = await getEIP1559GasPrice()

    // only used to estimate gas
    const fakeSignature = encodeSignature(
      approval,
      '0x' + '0'.repeat(130)
    )
    const userOp: UserOperation = {
      sender: smartWallet.address,
      nonce,
      callData: approveTokenWA.data!,
      paymasterAndData: '0x',
      initCode: '0x',
      callGasLimit: 0,
      verificationGasLimit: 0,
      preVerificationGas: 0,
      ...gasPriceData,
      // use truly guardian signatures
      signature: fakeSignature
    }

    // estimate all kinds of gas
    const gas = await estimateUserOpGas(entrypoint, userOp)
    const finalUserOp = {
      ...userOp,
      ...gas
    }

    // get owner signature
    const userOpHash = getUserOpHash(
      finalUserOp,
      entrypoint.address,
      chainId
    )
    const ownerSignature = await smartWalletOwner.signMessage(
      arrayify(userOpHash)
    )
    const signature = encodeSignature(approval, ownerSignature)
    const signedUserOp = { ...finalUserOp, signature }

    const { returnInfo } = await entrypoint.callStatic
      .simulateValidation(signedUserOp)
      .catch(simulationResultCatch)
    // check estimated verificationGasLimit is greater than actual used verification gas
    expect(gas.verificationGasLimit).gt(
      returnInfo.preOpGas.sub(signedUserOp.preVerificationGas)
    )

    await sendUserOp(signedUserOp)
    expect(
      await usdtToken.allowance(smartWallet.address, receiver)
    ).to.eq(tokenAmount)
  })
  it('estimate gas when using paymaster', async () => {})
})
