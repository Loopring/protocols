import { scope, types } from 'hardhat/config'
import {
  TASK_DEPLOY_CONTRACTS,
  type DeployTask
} from 'tasks/task_helper'
import {
  checkValidContractAddress,
  processAddressOrName
} from 'src/deploy_utils'
import assert from 'assert'
import { BigNumber } from 'ethers'

export const SCOPE_PAYMSTER = 'paymaster'
export const TASK_DEPLOY = 'deploy'
export const TASK_REGISTER_TOKEN = 'register-token'
export const TASK_ADD_SIGNER = 'add-signer'
export const TASK_DEPOSIT_TOKENS = 'deposit-token'
export const TASK_WITHDRAW_TOKENS = 'withdraw-token'
export const TASK_TRANSFER_OWNERSHIP = 'transfer-ownership'

const paymasterScope = scope(SCOPE_PAYMSTER, 'paymaster')

paymasterScope
  .task(TASK_DEPLOY)
  .addOptionalParam(
    'paymasterOwner',
    'paymaster owner',
    undefined,
    types.string
  )
  .setAction(
    async (
      { paymasterOwner }: { paymasterOwner?: string },
      { ethers, run, deployResults }
    ) => {
      const [deployer] = await ethers.getSigners()
      await checkValidContractAddress(
        deployResults.EntryPoint,
        ethers.provider
      )
      const tasks: DeployTask[] = [
        {
          contractName: 'LoopringPaymaster',
          args: [
            deployResults.EntryPoint,
            paymasterOwner ?? deployer.address
          ]
        }
      ]
      await run(TASK_DEPLOY_CONTRACTS, { tasks })
    }
  )

paymasterScope
  .task(TASK_REGISTER_TOKEN)
  .addParam(
    'tokens',
    'token address/name list, split by comma',
    undefined,
    types.string
  )
  .setAction(
    async (
      { tokens: tokensArg }: { tokens: string },
      { ethers, run, deployResults }
    ) => {
      const tokens = tokensArg.split(',')
      const paymaster = await ethers.getContractAt(
        'LoopringPaymaster',
        deployResults.LoopringPaymaster
      )
      for (let token of tokens) {
        // preprocess
        token = processAddressOrName(token, deployResults)
        await checkValidContractAddress(token, ethers.provider)
        await checkValidContractAddress(
          deployResults.LoopringPaymaster,
          ethers.provider
        )
        if (await paymaster.registeredToken(token)) {
          console.log(`token: ${token} is registerd already`)
        } else {
          await (await paymaster.addToken(token)).wait()
          console.log(`token: ${token} is registerd successfully`)
        }
      }
    }
  )

paymasterScope
  .task(TASK_ADD_SIGNER)
  .addParam(
    'signer',
    'signer address list, split by comma',
    undefined,
    types.string
  )
  .setAction(
    async (
      { signer: signersArg }: { signer: string },
      { ethers, run, deployResults }
    ) => {
      await checkValidContractAddress(
        deployResults.LoopringPaymaster,
        ethers.provider
      )
      const paymaster = await ethers.getContractAt(
        'LoopringPaymaster',
        deployResults.LoopringPaymaster
      )
      const signerRole = await paymaster.SIGNER()
      const signers = signersArg.split(',')
      for (const signer of signers) {
        assert(ethers.utils.isAddress(signer), 'invalid signer')
        if (await paymaster.hasRole(signerRole, signer)) {
          console.log(`operator ${signer} has permission already`)
        } else {
          await (await paymaster.grantRole(signerRole, signer)).wait()
          console.log(`grant role to ${signer} successfully`)
        }
      }
    }
  )

paymasterScope
  .task(TASK_DEPOSIT_TOKENS)
  .addParam('token', 'token address/name', undefined, types.string)
  .addParam('amount', 'token amount', undefined, types.string)
  .addParam(
    'receiver',
    'address/name what deposit for',
    undefined,
    types.string
  )
  .setAction(
    async (
      {
        token,
        amount,
        receiver: smartWallet
      }: { token: string; amount: string; receiver: string },
      { ethers, run, deployResults }
    ) => {
      const [deployer] = await ethers.getSigners()
      token = processAddressOrName(token, deployResults)
      smartWallet = processAddressOrName(smartWallet, deployResults)
      await checkValidContractAddress(token, ethers.provider)
      const tokenContract = await ethers.getContractAt(
        'IERC20Metadata',
        token
      )
      await checkValidContractAddress(
        deployResults.LoopringPaymaster,
        ethers.provider
      )
      const paymaster = await ethers.getContractAt(
        'LoopringPaymaster',
        deployResults.LoopringPaymaster
      )

      const decimals = await tokenContract.decimals()
      const tokenFundedAmount = ethers.utils.parseUnits(
        amount,
        decimals
      )

      if (
        (await tokenContract.balanceOf(deployer.address)).lt(
          tokenFundedAmount
        )
      ) {
        throw new Error(
          `deployer:${deployer.address} have no enough tokens`
        )
      }
      // deployer approve tokens to paymaster
      await (
        await tokenContract.approve(
          paymaster.address,
          tokenFundedAmount
        )
      ).wait()
      await (
        await paymaster.addDepositFor(
          token,
          smartWallet,
          tokenFundedAmount
        )
      ).wait()
    }
  )

paymasterScope
  .task(TASK_WITHDRAW_TOKENS)
  .addParam('token', 'token address/name', undefined, types.string)
  .addOptionalParam(
    'amount',
    'token amount, default to withdraw all available tokens',
    undefined,
    types.string
  )
  .addOptionalParam(
    'receiver',
    'receiver address',
    undefined,
    types.string
  )
  .setAction(
    async (
      {
        token,
        amount,
        receiver
      }: { token: string; amount?: string; receiver: string },
      { ethers, run, deployResults }
    ) => {
      const [deployer] = await ethers.getSigners()
      token = processAddressOrName(token, deployResults)
      await checkValidContractAddress(token, ethers.provider)
      await checkValidContractAddress(
        deployResults.LoopringPaymaster,
        ethers.provider
      )
      const paymaster = await ethers.getContractAt(
        'LoopringPaymaster',
        deployResults.LoopringPaymaster
      )

      const { amount: depositedTokenAmount } =
        await paymaster.depositInfo(token, deployer.address)
      const tokenFundedAmount =
        amount === undefined
          ? BigNumber.from(amount)
          : depositedTokenAmount

      // deployer approve tokens to paymaster
      await (
        await paymaster.withdrawTokensTo(
          token,
          receiver ?? deployer.address,
          tokenFundedAmount
        )
      ).wait()
    }
  )

paymasterScope
  .task(TASK_TRANSFER_OWNERSHIP, 'transfer ownership')
  .addParam(
    'owner',
    'new owner to transfer to',
    undefined,
    types.string
  )
  .addFlag(
    'revoke',
    'revoke all roles of current owner including admin and signer'
  )
  .setAction(
    async (
      { owner: newOwner, revoke }: { owner: string; revoke: boolean },
      { ethers, deployResults }
    ) => {
      const paymaster = await ethers.getContractAt(
        'LoopringPaymaster',
        deployResults.LoopringPaymaster
      )

      const curOwner = await paymaster.owner()
      const [deployer] = await ethers.getSigners()
      assert(
        curOwner === deployer.address,
        `you are not current paymaster owner`
      )

      if (curOwner !== newOwner) {
        const adminRole = await paymaster.DEFAULT_ADMIN_ROLE()
        const signer = await paymaster.SIGNER()

        await (await paymaster.grantRole(adminRole, newOwner)).wait()
        await (await paymaster.grantRole(signer, newOwner)).wait()

        if (revoke) {
          // revoke previous permission
          await (
            await paymaster.revokeRole(signer, deployer.address)
          ).wait()
          await (
            await paymaster.revokeRole(adminRole, deployer.address)
          ).wait()
        }

        // transfer ownership finally
        await (await paymaster.transferOwnership(newOwner)).wait()
      }
    }
  )
