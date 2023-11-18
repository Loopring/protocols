import {
  loadFixture,
  setBalance,
  time
} from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import {
  SmartWalletV3__factory
} from '../typechain-types'

import {
  fillAndMultiSign
} from './helper/AASigner'
import { ActionType } from './helper/LoopringGuardianAPI'
import { fixture } from './helper/fixture'
import {
  createSmartWallet,
  sendTx
} from './helper/utils'

describe('lock test', () => {
  it('basic success testcase', async () => {
    const {
      entrypoint,
      smartWallet,
      smartWalletOwner,
      create2,
      sendUserOp,
      smartWalletImpl,
      guardians
    } = await loadFixture(fixture)
    // lock wallet from owner first
    await smartWallet.lock()
    expect((await smartWallet.wallet()).locked).to.equal(true)
    // TODO(allow to double lock?)
    await expect(smartWallet.lock()).not.to.reverted
    const callData = smartWallet.interface.encodeFunctionData('unlock')
    const approvalOption = {
      validUntil: 0,
      salt: ethers.utils.randomBytes(32),
      action_type: ActionType.Unlock
    }
    const signedUserOp = await fillAndMultiSign(
      callData,
      smartWallet,
      smartWalletOwner,
      [
        { signer: guardians[0] },
        {
          signer: smartWalletOwner
        }
      ],
      create2.address,
      smartWalletImpl.address,
      approvalOption,
      entrypoint
    )
    await sendUserOp(signedUserOp)

    // check
    expect((await smartWallet.wallet()).locked).to.equal(false)

    // replay test
    await expect(sendUserOp(signedUserOp))
      .to.revertedWithCustomError(entrypoint, 'FailedOp')
      .withArgs(0, 'AA23 reverted: HASH_EXIST')
  })
  describe('lock test', () => {
    it('lock success from guardian', async () => {
      const {
        smartWallet,
        deployer,
        guardians
      } = await loadFixture(fixture)
      await setBalance(guardians[0].address, ethers.utils.parseEther('100'))
      await expect(smartWallet.connect(guardians[0]).lock()).not.to.reverted
      // check wallet is lock
      expect((await smartWallet.wallet()).locked).to.equal(true)
      // others cannot lock wallet
      await expect(smartWallet.connect(deployer).lock()).to.revertedWith(
        'NOT_FROM_WALLET_OR_OWNER_OR_GUARDIAN'
      )
    })

    it('lock success directly from entrypoint', async () => {
      const { entrypoint, smartWallet, smartWalletOwner, create2, sendUserOp } =
        await loadFixture(fixture)
      const lock = await smartWallet.populateTransaction.lock()

      await sendTx(
        [lock],
        smartWallet,
        smartWalletOwner,
        create2,
        entrypoint,
        sendUserOp,
        undefined,
        false
      )
      expect((await smartWallet.wallet()).locked).to.equal(true)
    })

    it('lock wallet by guardian(smart wallet)', async () => {
      // create new smart wallet as guardian then add it
      const {
        entrypoint,
        smartWallet,
        create2,
        sendUserOp,
        walletFactory
      } = await loadFixture(fixture)
      const guardianOwner = ethers.Wallet.createRandom().connect(
        ethers.provider
      )
      const salt = ethers.utils.formatBytes32String('0x5')
      await createSmartWallet(guardianOwner, [], walletFactory, salt)
      const smartWalletAddr = await walletFactory.computeWalletAddress(
        guardianOwner.address,
        salt
      )
      const guardian = SmartWalletV3__factory.connect(
        smartWalletAddr,
        guardianOwner
      )
      // add guardian
      expect(await smartWallet.isGuardian(guardian.address, true)).to.be.false
      await smartWallet.addGuardian(guardian.address)
      expect(await smartWallet.isGuardian(guardian.address, true)).to.be.true
      await time.increase(3600 * 24 * 3)
      expect(await smartWallet.isGuardian(guardian.address, false)).to.be.true

      expect((await smartWallet.wallet()).locked).to.equal(false)
      const lock = await smartWallet.populateTransaction.lock()
      await setBalance(guardian.address, ethers.utils.parseEther('100'))
      // note that user op here is signed by guardian owner
      // instead of guardian when it is smart wallet rather than EOA
      await sendTx(
        [lock],
        guardian,
        guardianOwner,
        create2,
        entrypoint,
        sendUserOp
      )
      // check if it is locked by the new guardian
      expect((await smartWallet.wallet()).locked).to.equal(true)
    })
  })
  describe('unlock test', () => {
    it('cannot unlock directly from wallet owner', async () => {
      const { smartWallet } = await loadFixture(fixture)
      await expect(smartWallet.unlock()).to.rejectedWith(
        'account: not EntryPoint'
      )
    })

    it('cannot unlock from entrypoint using `execute` api', async () => {
      const { entrypoint, smartWallet, smartWalletOwner, create2, sendUserOp } =
        await loadFixture(fixture)
      const unlock = await smartWallet.populateTransaction.unlock()

      // NOTE cannot allow unlock using callcontract api
      await expect(
        sendTx(
          [unlock],
          smartWallet,
          smartWalletOwner,
          create2,
          entrypoint,
          sendUserOp
        )
      ).to.revertedWith('SELF_CALL_DISALLOWED')
    })
  })
})
