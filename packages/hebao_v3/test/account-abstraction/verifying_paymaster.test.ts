import { expect } from 'chai'
import { type Wallet } from 'ethers'
import {
  arrayify,
  defaultAbiCoder,
  hexConcat,
  parseEther
} from 'ethers/lib/utils'
import { ethers } from 'hardhat'

import {
  type EntryPoint,
  type SimpleAccount,
  type VerifyingPaymaster,
  VerifyingPaymaster__factory
} from '../../typechain-types'

import { fillAndSign } from './UserOp'
import { type UserOperation } from './UserOperation'
import {
  createAccount,
  createAccountOwner,
  createAddress,
  deployEntryPoint,
  simulationResultCatch
} from './testutils'

const MOCK_VALID_UNTIL = '0x00000000deadbeef'
const MOCK_VALID_AFTER = '0x0000000000001234'
const MOCK_SIG = '0x1234'

describe('EntryPoint with VerifyingPaymaster', function () {
  let entryPoint: EntryPoint
  let accountOwner: Wallet
  const ethersSigner = ethers.provider.getSigner()
  let account: SimpleAccount
  let offchainSigner: Wallet

  let paymaster: VerifyingPaymaster
  before(async function () {
    this.timeout(20000)
    entryPoint = await deployEntryPoint()

    offchainSigner = createAccountOwner()
    accountOwner = createAccountOwner()

    paymaster = await new VerifyingPaymaster__factory(
      ethersSigner
    ).deploy(entryPoint.address, offchainSigner.address)
    await paymaster.addStake(1, { value: parseEther('2') })
    await entryPoint.depositTo(paymaster.address, {
      value: parseEther('1')
    })
    ;({ proxy: account } = await createAccount(
      ethersSigner,
      accountOwner.address,
      entryPoint.address
    ))
  })

  describe('#parsePaymasterAndData', () => {
    it('should parse data properly', async () => {
      const paymasterAndData = hexConcat([
        paymaster.address,
        defaultAbiCoder.encode(
          ['uint48', 'uint48'],
          [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]
        ),
        MOCK_SIG
      ])
      console.log(paymasterAndData)
      const res =
        await paymaster.parsePaymasterAndData(paymasterAndData)
      expect(res.validUntil).to.be.equal(
        ethers.BigNumber.from(MOCK_VALID_UNTIL)
      )
      expect(res.validAfter).to.be.equal(
        ethers.BigNumber.from(MOCK_VALID_AFTER)
      )
      expect(res.signature).equal(MOCK_SIG)
    })
  })

  describe('#validatePaymasterUserOp', () => {
    it('should reject on no signature', async () => {
      const userOp = await fillAndSign(
        {
          sender: account.address,
          paymasterAndData: hexConcat([
            paymaster.address,
            defaultAbiCoder.encode(
              ['uint48', 'uint48'],
              [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]
            ),
            '0x1234'
          ])
        },
        accountOwner,
        entryPoint
      )
      await expect(
        entryPoint.callStatic.simulateValidation(userOp)
      ).to.be.rejectedWith(
        'invalid signature length in paymasterAndData'
      )
    })

    it('should reject on invalid signature', async () => {
      const userOp = await fillAndSign(
        {
          sender: account.address,
          paymasterAndData: hexConcat([
            paymaster.address,
            defaultAbiCoder.encode(
              ['uint48', 'uint48'],
              [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]
            ),
            '0x' + '00'.repeat(65)
          ])
        },
        accountOwner,
        entryPoint
      )
      await expect(
        entryPoint.callStatic.simulateValidation(userOp)
      ).to.be.rejectedWith('ECDSA: invalid signature')
    })

    describe('with wrong signature', () => {
      let wrongSigUserOp: UserOperation
      const beneficiaryAddress = createAddress()
      before(async () => {
        const sig = await offchainSigner.signMessage(
          arrayify('0xdead')
        )
        wrongSigUserOp = await fillAndSign(
          {
            sender: account.address,
            paymasterAndData: hexConcat([
              paymaster.address,
              defaultAbiCoder.encode(
                ['uint48', 'uint48'],
                [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]
              ),
              sig
            ])
          },
          accountOwner,
          entryPoint
        )
      })

      it('should return signature error (no revert) on wrong signer signature', async () => {
        const ret = await entryPoint.callStatic
          .simulateValidation(wrongSigUserOp)
          .catch(simulationResultCatch)
        expect(ret.returnInfo.sigFailed).to.be.true
      })

      it('handleOp revert on signature failure in handleOps', async () => {
        await expect(
          entryPoint.estimateGas.handleOps(
            [wrongSigUserOp],
            beneficiaryAddress
          )
        ).to.rejectedWith('AA34 signature error')
      })
    })

    it('succeed with valid signature', async () => {
      const userOp1 = await fillAndSign(
        {
          sender: account.address,
          paymasterAndData: hexConcat([
            paymaster.address,
            defaultAbiCoder.encode(
              ['uint48', 'uint48'],
              [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]
            ),
            '0x' + '00'.repeat(65)
          ])
        },
        accountOwner,
        entryPoint
      )
      const hash = await paymaster.getHash(
        userOp1,
        MOCK_VALID_UNTIL,
        MOCK_VALID_AFTER
      )
      const sig = await offchainSigner.signMessage(arrayify(hash))
      const userOp = await fillAndSign(
        {
          ...userOp1,
          paymasterAndData: hexConcat([
            paymaster.address,
            defaultAbiCoder.encode(
              ['uint48', 'uint48'],
              [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]
            ),
            sig
          ])
        },
        accountOwner,
        entryPoint
      )
      const res = await entryPoint.callStatic
        .simulateValidation(userOp)
        .catch(simulationResultCatch)
      expect(res.returnInfo.sigFailed).to.be.false
      expect(res.returnInfo.validAfter).to.be.equal(
        ethers.BigNumber.from(MOCK_VALID_AFTER)
      )
      expect(res.returnInfo.validUntil).to.be.equal(
        ethers.BigNumber.from(MOCK_VALID_UNTIL)
      )
    })
  })
})
