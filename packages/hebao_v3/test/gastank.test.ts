import {
  loadFixture,
  setBalance,
  time
} from '@nomicfoundation/hardhat-network-helpers'
import { fixture } from './helper/fixture'
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time'
import { expect, assert } from 'chai'
import { ethers } from 'hardhat'
import { type BigNumber, type Signer } from 'ethers'
import { type TransactionRequest } from '@ethersproject/providers'
import { type Deferrable } from '@ethersproject/properties'
import {
  sendTx,
  type PaymasterOption,
  evInfo
} from '../test/helper/utils'
import {
  type USDT,
  type EntryPoint,
  type SmartWalletV3
} from '../typechain-types'

interface TestTransaction {
  name: string
  tx: Deferrable<TransactionRequest>
}

async function getTxs(usdtToken: USDT): Promise<TestTransaction[]> {
  const receivedAddress = ethers.constants.AddressZero
  const approveToken = await usdtToken.populateTransaction.approve(
    receivedAddress,
    ethers.constants.MaxUint256
  )
  const tokenAmount = ethers.utils.parseUnits('100', 6)
  const transferToken = await usdtToken.populateTransaction.transfer(
    receivedAddress,
    tokenAmount
  )
  const transferEth = {
    value: 1,
    to: receivedAddress
  }
  const txs = [
    { name: 'transferToken', tx: transferToken },
    { name: 'transferEth', tx: transferEth },
    { name: 'approveToken', tx: approveToken }
  ]
  return txs
}

async function prepareTokens(
  deployer: Signer,
  smartWalletAddr: string,
  depositAmount: BigNumber,
  usdtToken: USDT
): Promise<void> {
  // mint more tokens than actual usage
  await (
    await usdtToken.setBalance(smartWalletAddr, depositAmount.mul(2))
  ).wait()
  await (
    await deployer.sendTransaction({
      to: smartWalletAddr,
      value: ethers.utils.parseEther('100')
    })
  ).wait()
}

async function testGastankAtPaymaster(
  loadedFixture: any
): Promise<void> {
  const {
    entrypoint,
    smartWallet,
    smartWalletOwner,
    usdtToken,
    deployer,
    sendUserOp,
    create2,
    paymaster,
    paymasterOwner
  } = loadedFixture
  // prepare mock usdt token first
  const depositAmount = ethers.utils.parseUnits('10000', 6)
  await prepareTokens(
    deployer,
    smartWallet.address,
    depositAmount,
    usdtToken
  )
  await (await paymaster.addToken(usdtToken.address)).wait()
  const paymasterOption: PaymasterOption = {
    paymaster,
    payToken: usdtToken,
    paymasterOwner,
    valueOfEth: ethers.utils.parseUnits('625', 12),
    validUntil: 0
  }
  const approveToken = await usdtToken.populateTransaction.approve(
    paymaster.address,
    ethers.constants.MaxUint256
  )
  // use eth to pay fee here
  await sendTx(
    [approveToken],
    smartWallet,
    smartWalletOwner,
    create2,
    entrypoint,
    sendUserOp
  )

  const addDepositFor =
    await paymaster.populateTransaction.addDepositFor(
      usdtToken.address,
      smartWallet.address,
      depositAmount
    )
  const txs = await getTxs(usdtToken)
  console.log(`\n----- test without gas tank -----\n`)
  for (const { tx, name } of txs) {
    console.log(`----- execute ${name} tx -----`)
    // warmup
    await sendTx(
      [tx],
      smartWallet,
      smartWalletOwner,
      create2,
      entrypoint,
      sendUserOp,
      paymasterOption
    )

    {
      const { amount } = await paymaster.depositInfo(
        usdtToken.address,
        smartWallet.address
      )
      if (amount.gt(0)) {
        throw new Error(
          `make sure no any deposited token to prevent from using gas tank`
        )
      }
      const recipt = await sendTx(
        [tx],
        smartWallet,
        smartWalletOwner,
        create2,
        entrypoint,
        sendUserOp,
        paymasterOption
      )
      const events = await evInfo(entrypoint, recipt)
      console.log(
        `actualGasUsed of ${name} without gas tank`,
        events[0].actualGasUsed
      )
    }
  }

  console.log(`\n----- test with gas tank -----\n`)
  await sendTx(
    [addDepositFor],
    smartWallet,
    smartWalletOwner,
    create2,
    entrypoint,
    sendUserOp
  )
  for (const { tx, name } of txs) {
    console.log(`----- execute ${name} tx -----`)
    // using gas tank
    const { amount } = await paymaster.depositInfo(
      usdtToken.address,
      smartWallet.address
    )
    if (amount.eq(0)) {
      throw new Error(`no any deposited token when using gas tank`)
    }
    const recipt = await sendTx(
      [tx],
      smartWallet,
      smartWalletOwner,
      create2,
      entrypoint,
      sendUserOp,
      paymasterOption
    )
    const events = await evInfo(entrypoint, recipt)
    console.log(
      `actualGasUsed of ${name} with gas tank`,
      events[0].actualGasUsed
    )
  }
}

async function withdrawAllEth(
  entrypoint: EntryPoint,
  smartWallet: SmartWalletV3
): Promise<void> {
  const amountBefore = await entrypoint.balanceOf(smartWallet.address)
  if (amountBefore.gt(0)) {
    // withdraw all eth from entrypoint to execute userop without gas tank
    await smartWallet.withdrawDepositTo(
      ethers.constants.AddressZero,
      amountBefore
    )
  }
}

async function testGastankAtEntrypoint(
  loadedFixture: any
): Promise<void> {
  const {
    entrypoint,
    smartWallet,
    smartWalletOwner,
    usdtToken,
    deployer,
    sendUserOp,
    create2
  } = loadedFixture
  const depositAmount = ethers.utils.parseUnits('10000', 6)
  await prepareTokens(
    deployer,
    smartWallet.address,
    depositAmount,
    usdtToken
  )
  // allow owner to send userop directly
  await (
    await deployer.sendTransaction({
      to: smartWalletOwner.address,
      value: ethers.utils.parseEther('100')
    })
  ).wait()
  const txs = await getTxs(usdtToken)

  console.log(`\n----- test without gas tank -----\n`)
  for (const { tx, name } of txs) {
    console.log(`----- execute ${name} tx -----`)
    // warmup
    await sendTx(
      [tx],
      smartWallet,
      smartWalletOwner,
      create2,
      entrypoint,
      sendUserOp
    )
    await withdrawAllEth(entrypoint, smartWallet)
    const amount = await entrypoint.balanceOf(smartWallet.address)
    if (amount.gt(0)) {
      throw new Error(
        `make sure no any eth deposited to prevent from using gas tank`
      )
    }
    const recipt = await sendTx(
      [tx],
      smartWallet,
      smartWalletOwner,
      create2,
      entrypoint,
      sendUserOp
    )
    const events = await evInfo(entrypoint, recipt)
    console.log(
      `actualGasUsed of ${name} without gas tank in entrypoint`,
      events[0].actualGasUsed
    )
  }
  console.log(`\n----- test with gas tank -----\n`)
  await entrypoint.depositTo(smartWallet.address, {
    value: ethers.utils.parseEther('100')
  })

  for (const { tx, name } of txs) {
    console.log(`----- execute ${name} tx -----`)
    const amount = await entrypoint.balanceOf(smartWallet.address)
    if (amount.eq(0)) {
      throw new Error(`no any deposited eth when using gas tank`)
    }
    const recipt = await sendTx(
      [tx],
      smartWallet,
      smartWalletOwner,
      create2,
      entrypoint,
      sendUserOp
    )
    const events = await evInfo(entrypoint, recipt)
    console.log(
      `actualGasUsed of ${name} with gas tank in entrypoint`,
      events[0].actualGasUsed
    )
  }
}

describe('gas tank test', () => {
  it.skip('test gas tank at paymaster', async () => {
    const loadedFixture = await loadFixture(fixture)
    await testGastankAtPaymaster(loadedFixture)
  })

  it('test gas tank at entrypoint', async () => {
    const loadedFixture = await loadFixture(fixture)
    await testGastankAtEntrypoint(loadedFixture)
  })
})
