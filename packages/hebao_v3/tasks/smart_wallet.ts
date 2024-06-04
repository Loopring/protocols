import { scope, types } from 'hardhat/config'
import { checkValidContractAddress } from 'src/deploy_utils'
import { entrypointAddr } from 'src/constants'
import {
  TASK_DEPLOY_CONTRACTS,
  type DeployTask
} from 'tasks/task_helper'

export const SCOPE_SMART_WALLET = 'smart-wallet'
export const TASK_DEPLOY = 'deploy'
export const TASK_CREATE = 'create'

const smartWalletScope = scope(SCOPE_SMART_WALLET, 'smart wallet')

smartWalletScope
  .task(TASK_DEPLOY)
  .addOptionalParam(
    'blankOwner',
    'default owner of smart wallet',
    undefined,
    types.string
  )
  .setAction(
    async (
      { blankOwner }: { blankOwner?: string },
      { ethers, network, deployResults, run }
    ) => {
      await checkValidContractAddress(
        deployResults.ConnectorRegistry,
        ethers.provider,
        'ConnectorRegistry'
      )
      await checkValidContractAddress(
        deployResults.EntryPoint ?? entrypointAddr,
        ethers.provider,
        'EntryPoint'
      )
      const [deployer] = await ethers.getSigners()
      const tasks: DeployTask[] = [
        {
          contractName: 'ERC1271Lib'
        },
        {
          contractName: 'ERC20Lib'
        },
        {
          contractName: 'GuardianLib'
        },
        {
          contractName: 'InheritanceLib',
          libs: ['GuardianLib']
        },
        {
          contractName: 'QuotaLib'
        },
        {
          contractName: 'UpgradeLib'
        },
        {
          contractName: 'WhitelistLib'
        },
        {
          contractName: 'LockLib',
          libs: ['GuardianLib']
        },
        {
          contractName: 'RecoverLib',
          libs: ['GuardianLib']
        },
        {
          contractName: 'ApprovalLib',
          libs: [
            'ERC20Lib',
            'GuardianLib',
            'LockLib',
            'RecoverLib',
            'UpgradeLib',
            'WhitelistLib'
          ]
        },
        {
          contractName: 'SmartWalletV3',
          args: [
            deployResults.PriceOracle ?? ethers.constants.AddressZero,
            blankOwner ?? deployer.address,
            deployResults.EntryPoint,
            deployResults.ConnectorRegistry
          ],
          libs: [
            'QuotaLib',
            'ApprovalLib',
            'InheritanceLib',
            'ERC1271Lib',
            'WhitelistLib',
            'UpgradeLib',
            'RecoverLib',
            'LockLib',
            'GuardianLib',
            'ERC20Lib'
          ]
        }
      ]

      await run(TASK_DEPLOY_CONTRACTS, { tasks })
    }
  )

smartWalletScope
  .task(TASK_CREATE)
  .addOptionalParam(
    'accountOwner',
    'smart wallet owner',
    undefined,
    types.string
  )
  .addFlag('create2', 'create by wallet factory')
  .addOptionalParam(
    'name',
    'name of new-created smart wallet',
    'smartWallet',
    types.string
  )
  .addOptionalParam(
    'guardians',
    'list of guardian addresses, split by comma',
    undefined,
    types.string
  )
  .setAction(
    async (
      {
        accountOwner,
        guardians: guardiansArg,
        name: smartWalletName
      }: { accountOwner?: string; guardians?: string; name: string },
      { ethers, network, deployResults, run }
    ) => {
      const [deployer] = await ethers.getSigners()
      // owner cannot be guardians
      const guardians =
        guardiansArg !== undefined ? guardiansArg.split(',') : []
      if (deployResults[smartWalletName] !== undefined) {
        console.log(
          `same tag is used already, please use another one`
        )
        return
      }
      const tasks: DeployTask[] = [
        {
          key: smartWalletName,
          contractName: 'WalletProxy',
          args: [deployResults.SmartWalletV3]
        }
      ]
      await run(TASK_DEPLOY_CONTRACTS, { tasks })

      // init
      const wallet = await ethers.getContractAt(
        'SmartWalletV3',
        deployResults[smartWalletName]
      )
      const config = {
        owner: accountOwner ?? deployer.address,
        guardians,
        quota: 0,
        inheritor: ethers.constants.AddressZero,
        feeRecipient: ethers.constants.AddressZero,
        feeToken: ethers.constants.AddressZero
      }

      const { owner } = await wallet.wallet()
      if (owner !== ethers.constants.AddressZero) {
        console.log(`initialized already, skip`)
      } else {
        await (
          await wallet.initialize(
            config.owner,
            config.guardians,
            config.quota,
            config.inheritor,
            config.feeRecipient,
            config.feeToken,
            0
          )
        ).wait()
      }
    }
  )
