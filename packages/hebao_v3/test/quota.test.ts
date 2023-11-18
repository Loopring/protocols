import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { Wallet } from 'ethers'
import { ethers } from 'hardhat'

import { fillAndMultiSign } from './helper/AASigner'
import { ActionType } from './helper/LoopringGuardianAPI'
import { fixture } from './helper/fixture'
import {
  deployWalletImpl,
  getBlockTimestamp,
  getCurrentQuota,
  sendTx
} from './helper/utils'

describe('quota test', () => {
  it('change daily quota from entrypoint directly', async () => {
    const { smartWallet, smartWalletOwner, create2, entrypoint, sendUserOp } =
      await loadFixture(fixture)
    const quotaAmount = ethers.utils.parseEther('20')
    const tx = await smartWallet.populateTransaction.changeDailyQuota(
      quotaAmount
    )
    await sendTx(
      [tx],
      smartWallet,
      smartWalletOwner,
      create2,
      entrypoint,
      sendUserOp,
      undefined,
      false
    )
    expect((await smartWallet.wallet()).quota.pendingQuota).to.eq(
      quotaAmount
    )

    await expect(
      sendTx(
        [tx],
        smartWallet,
        smartWalletOwner,
        create2,
        entrypoint,
        sendUserOp
      )
    ).to.revertedWith('SELF_CALL_DISALLOWED')
  })
  it('change daily quota from wallet owner', async () => {
    const { smartWallet: wallet } = await loadFixture(fixture)
    const quotaAmount = ethers.utils.parseEther('10')
    await wallet.changeDailyQuota(quotaAmount)
    const quotaInfo = (await wallet.wallet()).quota

    expect(quotaInfo.pendingQuota).to.equal(quotaAmount)
    expect(quotaInfo.pendingUntil).to.equal(0)
  })

  it('changeDailyQuota extra test', async () => {
    const {
      smartWallet: wallet
    } = await loadFixture(fixture)

    const quotaAmount = ethers.utils.parseEther('10')
    const tx = await wallet.changeDailyQuota(quotaAmount)
    const quotaInfo = (await wallet.wallet()).quota
    // 0 (MAX_AMOUNT) => quotaAmount, become effective immediately.
    const currentQuota = await getCurrentQuota(quotaInfo, tx.blockNumber!)
    expect(currentQuota).to.equal(quotaAmount)
    expect(quotaInfo.pendingQuota).to.equal(quotaAmount)
    expect(quotaInfo.pendingUntil).to.equal(0)

    await time.increase(3600 * 24)
    const quotaAmount2 = ethers.utils.parseEther('20')
    const tx2 = await wallet.changeDailyQuota(quotaAmount2)
    const blockTime2 = await getBlockTimestamp(tx2.blockNumber!)
    const quotaInfo2 = (await wallet.wallet()).quota
    const currentQuota2 = await getCurrentQuota(quotaInfo2, tx2.blockNumber!)
    expect(currentQuota2).to.equal(quotaAmount)
    expect(quotaInfo2.pendingQuota).to.equal(quotaAmount2)
    expect(quotaInfo2.pendingUntil).to.equal(
      blockTime2 + 3600 * 24
    )

    await time.increase(3600 * 24)
    const quotaAmount3 = ethers.utils.parseEther('50')
    const tx3 = await wallet.changeDailyQuota(quotaAmount3)
    const blockTime3 = await getBlockTimestamp(tx3.blockNumber!)
    const quotaInfo3 = (await wallet.wallet()).quota
    const currentQuota3 = await getCurrentQuota(quotaInfo3, tx3.blockNumber!)
    expect(currentQuota3).to.equal(quotaAmount2)
    expect(quotaInfo3.pendingQuota).to.equal(quotaAmount3)
    expect(quotaInfo3.pendingUntil).to.equal(
      blockTime3 + 3600 * 24
    )

    await time.increase(3600 * 24)

    // newQuota < currentQuota, newQuota will become effective immediately.
    const quotaAmount4 = ethers.utils.parseEther('49')
    const tx4 = await wallet.changeDailyQuota(quotaAmount4)
    const quotaInfo4 = (await wallet.wallet()).quota
    const currentQuota4 = await getCurrentQuota(quotaInfo4, tx4.blockNumber!)
    expect(currentQuota4).to.equal(quotaAmount4)
    expect(quotaInfo4.pendingQuota).to.equal(quotaAmount4)
    expect(quotaInfo4.pendingUntil).to.equal(0)
  })

  it('changeDailyQuotaWA', async () => {
    const {
      smartWallet,
      smartWalletOwner,
      guardians,
      create2,
      entrypoint,
      sendUserOp,
      smartWalletImpl
    } = await loadFixture(fixture)
    const approvalOption = {
      validUntil: 0,
      salt: ethers.utils.randomBytes(32),
      action_type: ActionType.ChangeDailyQuota
    }
    const newQuota = '1' + '0'.repeat(20)
    const callData = smartWallet.interface.encodeFunctionData(
      'changeDailyQuotaWA',
      [newQuota]
    )
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

    const recipt = await sendUserOp(signedUserOp)

    const quotaInfo = (await smartWallet.wallet()).quota
    const currentQuota = await getCurrentQuota(quotaInfo, recipt.blockNumber)
    expect(currentQuota).to.equal(newQuota)
    expect(quotaInfo.pendingUntil).to.equal(0)
  })

  describe('quota check test', () => {
    const ONE_DAY = 3600 * 24
    it('will failed when usage excess daily quota', async () => {
      const {
        smartWallet,
        smartWalletOwner,
        guardians,
        create2,
        entrypoint,
        sendUserOp,
        blankOwner,
        usdtToken,
        smartWalletImpl
      } = await loadFixture(fixture)

      const oraclePrice = 1
      const testPriceOracle = await (
        await ethers.getContractFactory('TestPriceOracle')
      ).deploy(oraclePrice)
      // create new smart wallet implementation with valid price oracle
      const newSmartWalletImpl = await deployWalletImpl(
        create2,
        entrypoint.address,
        blankOwner.address,
        testPriceOracle.address
      )
      const callData = smartWallet.interface.encodeFunctionData(
        'changeMasterCopy',
        [newSmartWalletImpl.address]
      )
      const approvalOption = {
        validUntil: 0,
        salt: ethers.utils.randomBytes(32),
        action_type: ActionType.ChangeMasterCopy
      }
      // update to new implementation
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
      const masterCopyOfWallet = await smartWallet.getMasterCopy()
      expect(masterCopyOfWallet).to.equal(newSmartWalletImpl.address)
      expect(await smartWallet.priceOracle()).to.eq(testPriceOracle.address)

      // spent daily quota using approving token
      const tokenAmount = ethers.utils.parseUnits('100', 6)
      const quotaAmount = ethers.utils.parseUnits('200', 6)
      const initTokenAmount = ethers.utils.parseUnits('1000', 6)
      await usdtToken.setBalance(smartWallet.address, initTokenAmount)

      await smartWallet.changeDailyQuota(quotaAmount)
      // advance time to make it valid immediately
      await time.increase(ONE_DAY)
      const receiver = ethers.constants.AddressZero
      await smartWallet.transferToken(
        usdtToken.address,
        receiver,
        tokenAmount,
        '0x',
        true
      )
      const quotaInfo = (await smartWallet.wallet()).quota
      const tokenValue = await testPriceOracle.tokenValue(
        usdtToken.address,
        tokenAmount
      )
      expect(quotaInfo.spentAmount).to.equal(tokenValue)

      // will fail when spent too much tokens
      await expect(
        smartWallet.transferToken(
          usdtToken.address,
          receiver,
          tokenAmount.mul(2),
          '0x',
          true
        )
      ).to.rejectedWith('QUOTA_EXCEEDED')
    })
    it('will reset quota after one day', async () => {
      const {
        smartWallet,
        smartWalletOwner,
        guardians,
        create2,
        entrypoint,
        sendUserOp,
        blankOwner,
        usdtToken,
        smartWalletImpl
      } = await loadFixture(fixture)

      const oraclePrice = 1
      const testPriceOracle = await (
        await ethers.getContractFactory('TestPriceOracle')
      ).deploy(oraclePrice)
      // create new smart wallet implementation with valid price oracle
      const newSmartWalletImpl = await deployWalletImpl(
        create2,
        entrypoint.address,
        blankOwner.address,
        testPriceOracle.address
      )
      const callData = smartWallet.interface.encodeFunctionData(
        'changeMasterCopy',
        [newSmartWalletImpl.address]
      )
      const approvalOption = {
        validUntil: 0,
        salt: ethers.utils.randomBytes(32),
        action_type: ActionType.ChangeMasterCopy
      }
      // update to new implementation
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
      const masterCopyOfWallet = await smartWallet.getMasterCopy()
      expect(masterCopyOfWallet).to.equal(newSmartWalletImpl.address)
      expect(await smartWallet.priceOracle()).to.eq(testPriceOracle.address)

      // spent daily quota using approving token
      const tokenAmount = ethers.utils.parseUnits('100', 6)
      const quotaAmount = ethers.utils.parseUnits('200', 6)
      const initTokenAmount = ethers.utils.parseUnits('1000', 6)
      await usdtToken.setBalance(smartWallet.address, initTokenAmount)

      await smartWallet.changeDailyQuota(quotaAmount)
      // advance time to make it valid immediately
      await time.increase(ONE_DAY)
      const receiver = ethers.constants.AddressZero
      await smartWallet.transferToken(
        usdtToken.address,
        receiver,
        tokenAmount,
        '0x',
        true
      )
      const quotaInfo = (await smartWallet.wallet()).quota
      const tokenValue = await testPriceOracle.tokenValue(
        usdtToken.address,
        tokenAmount
      )
      expect(quotaInfo.spentAmount).to.equal(tokenValue)

      // will fail when spent too much tokens
      await expect(
        smartWallet.transferToken(
          usdtToken.address,
          receiver,
          tokenAmount.mul(2),
          '0x',
          true
        )
      ).to.rejectedWith('QUOTA_EXCEEDED')

      await time.increase(ONE_DAY)
      await expect(
        smartWallet.transferToken(
          usdtToken.address,
          receiver,
          tokenAmount.mul(2),
          '0x',
          false
        )
      ).not.to.reverted
    })
    it('whitelist address can excess daily quota', async () => {
      const {
        smartWallet,
        smartWalletOwner,
        guardians,
        create2,
        entrypoint,
        sendUserOp,
        smartWalletImpl,
        blankOwner,
        usdtToken
      } = await loadFixture(fixture)

      const oraclePrice = 1
      const testPriceOracle = await (
        await ethers.getContractFactory('TestPriceOracle')
      ).deploy(oraclePrice)
      // create new smart wallet implementation with valid price oracle
      const approvalOption = {
        validUntil: 0,
        salt: ethers.utils.randomBytes(32),
        action_type: ActionType.ChangeMasterCopy
      }
      const newSmartWalletImpl = await deployWalletImpl(
        create2,
        entrypoint.address,
        blankOwner.address,
        testPriceOracle.address
      )
      // update to new implementation
      const callData = smartWallet.interface.encodeFunctionData(
        'changeMasterCopy',
        [newSmartWalletImpl.address]
      )
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
      const masterCopyOfWallet = await smartWallet.getMasterCopy()
      expect(masterCopyOfWallet).to.equal(newSmartWalletImpl.address)
      expect(await smartWallet.priceOracle()).to.eq(testPriceOracle.address)

      // spent daily quota using approving token
      const tokenAmount = ethers.utils.parseUnits('100', 6)
      const quotaAmount = ethers.utils.parseUnits('200', 6)
      const initTokenAmount = ethers.utils.parseUnits('1000', 6)
      await usdtToken.setBalance(smartWallet.address, initTokenAmount)

      await smartWallet.changeDailyQuota(quotaAmount)
      // advance time to make it valid immediately
      await time.increase(ONE_DAY)
      const receiver1 = Wallet.createRandom().address
      const receiver2 = Wallet.createRandom().address
      await smartWallet.addToWhitelist(receiver2)
      await time.increase(ONE_DAY)
      await smartWallet.transferToken(
        usdtToken.address,
        receiver1,
        tokenAmount,
        '0x',
        false
      )
      const quotaInfo = (await smartWallet.wallet()).quota
      const tokenValue = await testPriceOracle.tokenValue(
        usdtToken.address,
        tokenAmount
      )
      expect(quotaInfo.spentAmount).to.equal(tokenValue)

      // will fail send to unwhitelisted address
      await expect(
        smartWallet.transferToken(
          usdtToken.address,
          receiver1,
          tokenAmount.mul(2),
          '0x',
          false
        )
      ).to.rejectedWith('QUOTA_EXCEEDED')

      // will success send to whitelisted address
      await expect(
        smartWallet.transferToken(
          usdtToken.address,
          receiver2,
          tokenAmount.mul(2),
          '0x',
          false
        )
      ).not.to.reverted
    })
  })
})
