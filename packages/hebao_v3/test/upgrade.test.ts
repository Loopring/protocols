import {
  loadFixture,
  time
} from '@nomicfoundation/hardhat-network-helpers'
import { expect, assert } from 'chai'

import { ethers } from 'hardhat'

import {
  DummySmartWallet__factory,
  type DummySmartWallet
} from '../typechain-types'

import { fillAndMultiSign } from './helper/AASigner'
import { ActionType } from './helper/LoopringGuardianAPI'
import { fixture } from './helper/fixture'
import { deployWalletImpl, getBlockTimestamp } from './helper/utils'

describe('wallet', () => {
  describe('upgrade', () => {
    it('wallet owner should be able to upgrade impl with enough approvals', async () => {
      const {
        smartWallet: wallet,
        guardians,
        smartWalletOwner,
        create2,
        entrypoint,
        sendUserOp,
        smartWalletImpl,
        smartWallet
      } = await loadFixture(fixture)
      const GuardianLib = await (
        await ethers.getContractFactory('GuardianLib')
      ).deploy()
      // deploy impl of new verision
      const newSmartWalletImpl: DummySmartWallet = await (
        await ethers.getContractFactory('DummySmartWallet', {
          libraries: { GuardianLib: GuardianLib.address }
        })
      ).deploy()

      const callData = smartWallet.interface.encodeFunctionData(
        'changeMasterCopy',
        [newSmartWalletImpl.address]
      )
      const approvalOption = {
        validUntil: 0,
        salt: ethers.utils.randomBytes(32),
        action_type: ActionType.ChangeMasterCopy
      }
      const signedUserOp = await fillAndMultiSign(
        callData,
        smartWallet,
        smartWalletOwner,
        [
          { signer: smartWalletOwner },
          {
            signer: guardians[0]
          }
        ],
        create2.address,
        smartWalletImpl.address,
        approvalOption,
        entrypoint
      )

      await sendUserOp(signedUserOp)

      const masterCopyOfWallet = await wallet.getMasterCopy()
      expect(masterCopyOfWallet).to.equal(newSmartWalletImpl.address)

      // test new impl

      const dummyWallet = DummySmartWallet__factory.connect(
        wallet.address,
        smartWalletOwner
      )
      await expect(dummyWallet.emitSomething())
        .to.emit(dummyWallet, 'Invoked')
        .withArgs('hello world')
      const newGuardians = await dummyWallet.getGuardians(true)
      // guardians data is the same as before
      guardians.forEach((g, i) =>
        expect(g.address).to.eq(newGuardians[i].addr)
      )
    })
  })

  describe('DelayedImplementationManager', () => {
    it('only owner is able to set nextImpl & effectiveTime', async () => {
      const { deployer, implStorage } = await loadFixture(fixture)
      const otherSigner = (await ethers.getSigners())[1]
      const owner = await implStorage.owner()
      expect(owner).to.equal(deployer.address)

      await expect(implStorage.executeUpgrade()).to.revertedWith(
        'NOT_IN_EFFECT'
      )

      const newImpl = '0x' + '11'.repeat(20)
      const tx = await implStorage.delayedUpgradeTo(newImpl, 1)
      const blockTime = await getBlockTimestamp(tx.blockNumber!)
      const receipt = await tx.wait()

      assert(
        receipt.events !== undefined && receipt.events.length > 0
      )

      const upgradeScheduledEvent = receipt.events[0].args!
      expect(upgradeScheduledEvent.nextImpl).to.equal(newImpl)
      expect(upgradeScheduledEvent.effectiveTime.toNumber()).to.equal(
        blockTime + 3600 * 24
      )

      const storageWithAnotherSigner =
        implStorage.connect(otherSigner)
      const signer2 =
        await storageWithAnotherSigner.signer.getAddress()
      expect(owner).not.to.equal(signer2)
      const newImpl2 = '0x' + '22'.repeat(20)
      await expect(
        storageWithAnotherSigner.delayedUpgradeTo(newImpl2, 1)
      ).to.revertedWith('UNAUTHORIZED')

      // execute upgrade before nexeEffectiveTime:
      await expect(
        storageWithAnotherSigner.executeUpgrade()
      ).to.revertedWith('NOT_IN_EFFECT')

      await time.increase(3600 * 24)
      const executeTx =
        await storageWithAnotherSigner.executeUpgrade()
      const executeReceipt = await executeTx.wait()
      assert(
        executeReceipt.events !== undefined &&
          executeReceipt.events.length > 0
      )
      const implementationChangedEvent =
        executeReceipt.events[0].args!
      expect(implementationChangedEvent.newImpl).to.equal(newImpl)

      // // upgrade can not be executed agin:
      await expect(implStorage.executeUpgrade()).to.revertedWith(
        'NOT_IN_EFFECT'
      )
    })

    it('upgrade for user wallet', async () => {
      const {
        forwardProxy,
        smartWallet,
        smartWalletOwner,
        implStorage,
        create2,
        guardians,
        sendUserOp,
        entrypoint,
        blankOwner,
        usdtToken,
        deployer
      } = await loadFixture(fixture)
      const currentImpl = await smartWallet.getMasterCopy()
      expect(currentImpl).to.eq(forwardProxy.address)
      expect(await smartWallet.blankOwner()).to.eq(blankOwner.address)

      // random blankowner
      const ownerSetter = ethers.Wallet.createRandom().connect(
        ethers.provider
      )
      const newSmartWalletImpl = await deployWalletImpl(
        create2,
        entrypoint.address,
        ownerSetter.address
      )
      await implStorage.delayedUpgradeTo(
        newSmartWalletImpl.address,
        1
      )
      await time.increase(3600 * 24)
      await implStorage.executeUpgrade()
      // check immutable data
      expect(await smartWallet.blankOwner()).to.eq(
        ownerSetter.address
      )

      // transfer token
      const receiver = deployer.address
      const initTokenAmount = ethers.utils.parseUnits('1000', 6)
      await usdtToken.setBalance(smartWallet.address, initTokenAmount)
      const tokenAmount = ethers.utils.parseUnits('100', 6)
      {
        const usdtTokenBalanceBefore =
          await usdtToken.balanceOf(receiver)
        await smartWallet.transferToken(
          usdtToken.address,
          receiver,
          tokenAmount,
          '0x',
          false
        )
        const usdtTokenBalanceAfter =
          await usdtToken.balanceOf(receiver)
        expect(
          usdtTokenBalanceAfter.sub(usdtTokenBalanceBefore)
        ).to.eq(tokenAmount)
      }

      // transfer token with approval(guardians is the same as before so that multisig is still valid)
      {
        const usdtTokenBalanceBefore =
          await usdtToken.balanceOf(receiver)
        const callData = smartWallet.interface.encodeFunctionData(
          'transferTokenWA',
          [usdtToken.address, receiver, tokenAmount, '0x']
        )
        const approvalOption = {
          validUntil: 0,
          salt: ethers.utils.randomBytes(32),
          action_type: ActionType.TransferToken
        }
        const signedUserOp = await fillAndMultiSign(
          callData,
          smartWallet,
          smartWalletOwner,
          [
            { signer: smartWalletOwner },
            {
              signer: guardians[0]
            }
          ],
          create2.address,
          newSmartWalletImpl.address,
          approvalOption,
          entrypoint
        )
        await sendUserOp(signedUserOp)
        const usdtTokenBalanceAfter =
          await usdtToken.balanceOf(receiver)
        expect(
          usdtTokenBalanceAfter.sub(usdtTokenBalanceBefore)
        ).to.eq(tokenAmount)
      }
    })
  })
})
