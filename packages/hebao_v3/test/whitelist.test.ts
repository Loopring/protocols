import {
  loadFixture,
  time
} from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { fillAndMultiSign } from './helper/AASigner'
import { ActionType } from './helper/LoopringGuardianAPI'
import { fixture } from './helper/fixture'
import { getBlockTimestamp } from './helper/utils'

describe('whitelist test', () => {
  const ONE_DAY = 3600 * 24
  it('owner should be able to add address to its whitelist', async () => {
    const whiteListedAddr = '0x' + '11'.repeat(20)
    const { smartWallet } = await loadFixture(fixture)
    await expect(
      smartWallet.addToWhitelist(ethers.constants.AddressZero)
    ).to.rejectedWith('LRC#104')
    const tx = await smartWallet.addToWhitelist(whiteListedAddr)
    const effectiveTime =
      await smartWallet.getWhitelistEffectiveTime(whiteListedAddr)
    const blockTime = await getBlockTimestamp(tx.blockNumber!)
    expect(effectiveTime.toNumber()).to.equal(blockTime + 3600 * 24)

    // advance one day
    await time.increase(ONE_DAY)
    expect(await smartWallet.isWhitelisted(whiteListedAddr)).to.be
      .true

    // remove it from whitelist
    await expect(
      smartWallet.removeFromWhitelist(ethers.constants.AddressZero)
    ).to.rejectedWith('LRC#104')
    await smartWallet.removeFromWhitelist(whiteListedAddr)
    expect(
      await smartWallet.getWhitelistEffectiveTime(whiteListedAddr)
    ).to.eq(0)
    expect(await smartWallet.isWhitelisted(whiteListedAddr)).to.be
      .false
  })

  it('majority(owner required) should be able to whitelist address immediately', async () => {
    const {
      smartWallet,
      smartWalletImpl,
      smartWalletOwner,
      guardians,
      create2,
      entrypoint,
      sendUserOp
    } = await loadFixture(fixture)
    const addr = '0x' + '12'.repeat(20)
    const callData = smartWallet.interface.encodeFunctionData(
      'addToWhitelistWA',
      [addr]
    )
    const approvalOption = {
      validUntil: 0,
      salt: ethers.utils.randomBytes(32),
      action_type: ActionType.AddToWhitelist
    }
    const signedUserOp = await fillAndMultiSign(
      callData,
      smartWallet,
      smartWalletOwner,
      [
        {
          signer: guardians[0]
        },
        { signer: smartWalletOwner }
      ],
      create2.address,
      smartWalletImpl.address,
      approvalOption,
      entrypoint
    )

    const recipt = await sendUserOp(signedUserOp)
    const effectiveTime =
      await smartWallet.getWhitelistEffectiveTime(addr)
    const blockTime = await getBlockTimestamp(recipt.blockNumber)
    expect(effectiveTime.toNumber()).to.equal(blockTime)

    // advance one day
    await time.increase(ONE_DAY)
    expect(await smartWallet.isWhitelisted(addr)).to.be.true
  })
})
