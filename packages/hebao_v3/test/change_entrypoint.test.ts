import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { localUserOpSender } from './helper/AASigner'
import { fixture } from './helper/fixture'
import { sendTx } from './helper/utils'
import { ErrorCodes } from './helper/error_codes'

describe('change entrypoint', () => {
  it('basic usecase', async () => {
    const {
      smartWallet,
      smartWalletOwner,
      entrypoint,
      usdtToken,
      paymaster,
      create2,
      deployer
    } = await loadFixture(fixture)
    // check old entrypoint address
    const entryPointAddr = await smartWallet.entryPoint()
    expect(entryPointAddr).eq(entrypoint.address)

    // deploy new entrypoint
    const newEntryPoint = await (
      await ethers.getContractFactory('EntryPoint')
    ).deploy()
    await smartWallet.changeEntryPoint(newEntryPoint.address)
    expect(await smartWallet.entryPoint()).eq(newEntryPoint.address)

    // send userop using new entrypoint
    // approve first
    const approveToken = await usdtToken.populateTransaction.approve(
      paymaster.address,
      ethers.constants.MaxUint256
    )

    const sendUserOp = localUserOpSender(
      newEntryPoint.address,
      deployer
    )
    await expect(
      sendTx(
        [approveToken],
        smartWallet,
        smartWalletOwner,
        create2,
        newEntryPoint,
        sendUserOp
      )
    ).not.to.reverted

    // cannot send userop from old entrypoint
    await expect(
      sendTx(
        [approveToken],
        smartWallet,
        smartWalletOwner,
        create2,
        entrypoint,
        sendUserOp
      )
    ).to.rejectedWith(
      `${ErrorCodes.NOT_OWNER_SELF_OR_ENTRYPOINT_OR_LOCKED}`
    )
  })

  it('failure cases', async () => {
    const { smartWallet } = await loadFixture(fixture)
    await expect(
      smartWallet.changeEntryPoint(ethers.constants.AddressZero)
    ).to.rejectedWith(`${ErrorCodes.ZERO_ADDRESS}`)
    await expect(
      smartWallet.changeEntryPoint(await smartWallet.entryPoint())
    ).to.rejectedWith(`${ErrorCodes.INVALID_SAME_ENTRYPOINT}`)

    const other = ethers.Wallet.createRandom().connect(
      ethers.provider
    )
    const newEntryPoint = '0x' + '11'.repeat(20)
    await expect(
      smartWallet.connect(other).changeEntryPoint(newEntryPoint)
    ).to.rejectedWith(
      `${ErrorCodes.NOT_OWNER_SELF_OR_ENTRYPOINT_OR_LOCKED}`
    )
  })
})
