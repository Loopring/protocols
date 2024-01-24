import {
  loadFixture,
  setBalance,
  takeSnapshot,
  time
} from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { SmartWalletV3__factory } from '../typechain-types'

import { fixture } from './helper/fixture'
import { createSmartWallet, sendTx } from './helper/utils'

describe('inheritor test', () => {
  it('basic success testcase', async () => {
    const { smartWallet, create2, entrypoint, sendUserOp } =
      await loadFixture(fixture)
    const inheritor = ethers.Wallet.createRandom().connect(
      ethers.provider
    )

    // check before
    const walletDataBefore = await smartWallet.wallet()
    expect(walletDataBefore.inheritor).to.eq(
      ethers.constants.AddressZero
    )
    expect(walletDataBefore.inheritWaitingPeriod).to.eq(0)

    const waitingPeriod = 3600 * 24 * 30
    await smartWallet.setInheritor(inheritor.address, waitingPeriod)

    const walletData = await smartWallet.wallet()
    expect(walletData.inheritor).to.eq(inheritor.address)
    expect(walletData.inheritWaitingPeriod).to.eq(waitingPeriod)

    // advance time
    const validBlockTime = walletData.lastActive.add(
      walletData.inheritWaitingPeriod
    )
    await time.increaseTo(validBlockTime)

    // inherit
    const newOwner = ethers.Wallet.createRandom().connect(
      ethers.provider
    )
    const tx = await smartWallet.populateTransaction.inherit(
      newOwner.address,
      [] /* keep all guardians */
    )

    const snapshotRestorer = await takeSnapshot()
    await sendTx(
      [tx],
      smartWallet,
      inheritor,
      create2,
      entrypoint,
      sendUserOp,
      undefined,
      false
    )
    expect(await smartWallet.getOwner()).to.eq(newOwner.address)

    // inherit successfully from inheritor directly
    {
      // reset inheritor
      await snapshotRestorer.restore()
      const walletDataBefore = await smartWallet.wallet()
      expect(walletDataBefore.inheritor).to.eq(inheritor.address)

      await setBalance(
        inheritor.address,
        ethers.utils.parseEther('100')
      )
      await smartWallet
        .connect(inheritor)
        .inherit(newOwner.address, [])
      expect(await smartWallet.getOwner()).to.eq(newOwner.address)
    }
  })

  it('inherit from other smart wallet', async () => {
    const {
      smartWallet,
      create2,
      entrypoint,
      sendUserOp,
      walletFactory
    } = await loadFixture(fixture)
    // create new smart wallet as inheritor
    const inheritorOwner = ethers.Wallet.createRandom().connect(
      ethers.provider
    )
    const salt = ethers.utils.formatBytes32String('0x5')
    await createSmartWallet(inheritorOwner, [], walletFactory, salt)
    const smartWalletAddr = await walletFactory.computeWalletAddress(
      inheritorOwner.address,
      salt
    )
    const inheritor = SmartWalletV3__factory.connect(
      smartWalletAddr,
      inheritorOwner
    )

    // set new inheritor for smartwallet
    const waitingPeriod = 3600 * 24 * 30
    await smartWallet.setInheritor(inheritor.address, waitingPeriod)
    const walletData = await smartWallet.wallet()
    const validBlockTime = walletData.lastActive.add(
      walletData.inheritWaitingPeriod
    )

    await time.increaseTo(validBlockTime)

    // inherit
    const newOwner = ethers.Wallet.createRandom().connect(
      ethers.provider
    )
    const tx = await smartWallet.populateTransaction.inherit(
      newOwner.address,
      [] /* keep all guardians */
    )

    const snapshotRestorer = await takeSnapshot()
    await sendTx(
      [tx],
      smartWallet,
      inheritorOwner,
      create2,
      entrypoint,
      sendUserOp,
      undefined,
      false
    )
    expect(await smartWallet.getOwner()).to.eq(newOwner.address)

    // inherit successfully from inheritor directly (send inherit userop from inheritor smart wallet)
    await snapshotRestorer.restore()
    // prepare gas for inheritor smartwallet
    await setBalance(
      inheritor.address,
      ethers.utils.parseEther('100')
    )
    // use execute api
    await sendTx(
      [tx],
      inheritor,
      inheritorOwner,
      create2,
      entrypoint,
      sendUserOp
    )
    expect(await smartWallet.getOwner()).to.eq(newOwner.address)
  })

  it('fail without waiting period', async () => {
    const { smartWallet, create2, entrypoint, sendUserOp } =
      await loadFixture(fixture)
    const inheritor = ethers.Wallet.createRandom().connect(
      ethers.provider
    )

    const walletDataBefore = await smartWallet.wallet()
    expect(walletDataBefore.inheritor).to.eq(
      ethers.constants.AddressZero
    )
    expect(walletDataBefore.inheritWaitingPeriod).to.eq(0)

    const waitingPeriod = 3600 * 24 * 30
    await smartWallet.setInheritor(inheritor.address, waitingPeriod)

    const walletData = await smartWallet.wallet()
    expect(walletData.inheritor).to.eq(inheritor.address)
    expect(walletData.inheritWaitingPeriod).to.eq(waitingPeriod)

    const validBlockTime = walletData.lastActive.add(
      walletData.inheritWaitingPeriod
    )
    await time.increaseTo(validBlockTime.sub(1))

    const newOwner = ethers.Wallet.createRandom().connect(
      ethers.provider
    )
    const tx = await smartWallet.populateTransaction.inherit(
      newOwner.address,
      [] /* keep all guardians */
    )
    await expect(
      sendTx(
        [tx],
        smartWallet,
        inheritor,
        create2,
        entrypoint,
        sendUserOp,
        undefined,
        false
      )
    ).to.be.revertedWith('TOO_EARLY')
  })

  it('inherit with a owner in guardians group', async () => {
    const test = async (removeGuardians: boolean): Promise<void> => {
      const { smartWallet, create2, entrypoint, sendUserOp } =
        await loadFixture(fixture)
      const inheritor = ethers.Wallet.createRandom().connect(
        ethers.provider
      )
      // check before
      const walletDataBefore = await smartWallet.wallet()
      expect(walletDataBefore.inheritor).to.eq(
        ethers.constants.AddressZero
      )
      expect(walletDataBefore.inheritWaitingPeriod).to.eq(0)

      const newOwner = ethers.Wallet.createRandom().connect(
        ethers.provider
      )
      // add newOwner to guardians group
      await smartWallet
        .addGuardian(newOwner.address)
        .then(async (tx) => tx.wait())
      const guardians = await smartWallet.getGuardians(true)
      // expect newOwner is on guardians group
      expect(
        guardians.some((g) => g.addr === newOwner.address)
      ).to.eq(true)

      const waitingPeriod = 3600 * 24 * 30
      await smartWallet.setInheritor(inheritor.address, waitingPeriod)
      await time.increase(waitingPeriod + 1)

      {
        const tx = await smartWallet.populateTransaction.inherit(
          newOwner.address,
          [newOwner.address] /* keep all guardians */
        )
        await expect(
          sendTx(
            [tx],
            smartWallet,
            inheritor,
            create2,
            entrypoint,
            sendUserOp,
            undefined,
            false
          )
        ).to.rejectedWith('INVALID_NEW_WALLET_GUARDIAN')
      }

      const tx = await smartWallet.populateTransaction.inherit(
        newOwner.address,
        [] /* keep all guardians */
      )
      await sendTx(
        [tx],
        smartWallet,
        inheritor,
        create2,
        entrypoint,
        sendUserOp,
        undefined,
        false
      )
      expect(await smartWallet.getOwner()).to.eq(newOwner.address)
      const guardians2 = await smartWallet.getGuardians(true)
      // expect newOwner is not on guardians group
      expect(
        guardians2.some((g) => g.addr === newOwner.address)
      ).to.eq(false)
    }
    await test(true) // removeGuardians: true
    await test(false) // removeGuardians: false
  })
})
