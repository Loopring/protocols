import { scope, types } from 'hardhat/config'
import {
  TASK_DEPLOY_CONTRACTS,
  TASK_VERIFY_CONTRACTS,
  type DeployTask
} from 'tasks/task_helper'
import {
  checkValidContractAddress,
  processAddressOrName
} from 'src/deploy_utils'

export const SCOPE_TOKEN = 'token'
export const TASK_DEPLOY = 'deploy'
export const TASK_VERIFY = 'verify'
export const TASK_MINT = 'mint'

const tokenScope = scope(SCOPE_TOKEN, 'token')

tokenScope
  .task(TASK_DEPLOY)
  .addParam(
    'tokens',
    'token names to deploy, avaiable tokens: USDT and LRC',
    undefined,
    types.string
  )
  .setAction(async ({ tokens }: { tokens: string }, { run }) => {
    // check tokens
    const tasks: DeployTask[] = []
    for (const token of tokens.split(',')) {
      tasks.push({
        contractName: token
      })
    }
    await run(TASK_DEPLOY_CONTRACTS, { tasks })
  })

tokenScope
  .task(TASK_VERIFY, 'verify tokens code')
  .addParam(
    'tokens',
    'token names to deploy, avaiable tokens: USDT and LRC',
    undefined,
    types.string
  )
  .setAction(async ({ tokens }: { tokens: string }, { run }) => {
    // check tokens
    const tasks: DeployTask[] = []
    for (const token of tokens.split(',')) {
      tasks.push({
        contractName: token
      })
    }
    await run(TASK_VERIFY_CONTRACTS, { tasks })
  })

tokenScope
  .task(TASK_MINT)
  .addOptionalParam(
    'receiver',
    'address/name to receive tokens',
    undefined,
    types.string
  )
  .addParam(
    'token',
    'token name/address to mint',
    undefined,
    types.string
  )
  .addOptionalParam(
    'amount',
    'token amount to mint',
    '10000',
    types.string
  )
  .setAction(
    async (
      {
        token,
        receiver,
        amount
      }: { token: string; receiver?: string; amount: string },
      { run, ethers, deployResults }
    ) => {
      // use deployer as receiver by default
      if (receiver === undefined) {
        const [deployer] = await ethers.getSigners()
        receiver = deployer.address
      }
      const tokenAddr = processAddressOrName(token, deployResults)
      // check valid token
      await checkValidContractAddress(tokenAddr, ethers.provider)
      const tokenContract = await ethers.getContractAt(
        'DummyToken',
        tokenAddr
      )
      const decimal = await tokenContract.decimals()
      const tokenAmount = ethers.utils.parseUnits(amount, decimal)
      await (
        await tokenContract.setBalance(
          processAddressOrName(receiver, deployResults),
          tokenAmount
        )
      ).wait()
    }
  )
