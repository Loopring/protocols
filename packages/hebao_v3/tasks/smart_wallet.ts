import { scope, types } from 'hardhat/config'
import {
  checkValidContractAddress,
  processAddressOrName
} from 'src/deploy_utils'
import {
  TASK_DEPLOY_CONTRACTS,
  TASK_VERIFY_CONTRACTS,
  type DeployTask
} from 'tasks/task_helper'
import { simulationResultCatch, fillAndMultiSign } from 'src/aa_utils'
import { ActionType } from 'src/LoopringGuardianAPI'
import assert from 'assert'

export const SCOPE_SMART_WALLET = 'smart-wallet'
export const TASK_DEPLOY = 'deploy'
export const TASK_VERIFY = 'verify'
export const TASK_CREATE = 'create'
export const TASK_UPGRADE_IMPL = 'upgrade-impl'
export const TASK_ADD_GUARDIANS = 'add-guardians'
const TASK_GET_TASKS = 'get-tasks'

const smartWalletScope = scope(SCOPE_SMART_WALLET, 'smart wallet')

smartWalletScope
  .subtask(TASK_GET_TASKS)
  .addOptionalParam('blankOwner', undefined, undefined, types.string)
  .addOptionalParam(
    'versionName',
    undefined,
    'SmartWalletV3',
    types.string
  )
  .setAction(
    async (
      {
        blankOwner,
        versionName
      }: { blankOwner: string; versionName: string },
      { ethers, deployResults }
    ) => {
      const [deployer] = await ethers.getSigners()
      await checkValidContractAddress(
        deployResults.ConnectorRegistry,
        ethers.provider,
        'ConnectorRegistry'
      )
      await checkValidContractAddress(
        deployResults.EntryPoint,
        ethers.provider,
        'EntryPoint'
      )
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
          key: versionName,
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
      return tasks
    }
  )

smartWalletScope
  .task(TASK_DEPLOY)
  .addOptionalParam(
    'blankOwner',
    'default owner of smart wallet',
    undefined,
    types.string
  )
  .addOptionalParam(
    'versionName',
    'version name for different implementation',
    'SmartWalletV3',
    types.string
  )
  .setAction(
    async (
      {
        blankOwner,
        versionName
      }: { blankOwner?: string; versionName: string },
      { ethers, network, deployResults, run }
    ) => {
      const tasks = await run(
        { scope: SCOPE_SMART_WALLET, task: TASK_GET_TASKS },
        { blankOwner, versionName }
      )

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
    'impl',
    'name/address of smart wallet implementation',
    'SmartWalletV3',
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
        name: smartWalletName,
        implName
      }: {
        accountOwner?: string
        guardians?: string
        name: string
        implName: string
      },
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
          args: [processAddressOrName(implName, deployResults)]
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

smartWalletScope
  .task(TASK_VERIFY)
  .addOptionalParam(
    'blankOwner',
    'default owner of smart wallet',
    undefined,
    types.string
  )
  .addOptionalParam(
    'versionName',
    'version name for different implementation',
    'SmartWalletV3',
    types.string
  )
  .addOptionalParam(
    'name',
    'name of new-created smart wallet',
    'smartWallet',
    types.string
  )
  .addOptionalParam(
    'impl',
    'name/address of smart wallet implementation',
    'SmartWalletV3',
    types.string
  )
  .setAction(
    async (
      {
        blankOwner,
        versionName,
        name: smartWalletName,
        impl: implName
      }: {
        blankOwner?: string
        versionName: string
        name: string
        impl: string
      },
      { run, deployResults }
    ) => {
      const tasks = await run(
        { scope: SCOPE_SMART_WALLET, task: TASK_GET_TASKS },
        { blankOwner, versionName }
      )
      // including any new created smart wallet
      tasks.push({
        key: smartWalletName,
        contractName: 'WalletProxy',
        args: [processAddressOrName(implName, deployResults)]
      })
      await run(TASK_VERIFY_CONTRACTS, { tasks })
    }
  )

smartWalletScope
  .task(TASK_UPGRADE_IMPL)
  .addParam(
    'impl',
    'new implementation address/name',
    undefined,
    types.string
  )
  .addOptionalParam(
    'beneficiary',
    'beneficiary address',
    undefined,
    types.string
  )
  .addOptionalParam(
    'name',
    'name of new-created smart wallet',
    'smartWallet',
    types.string
  )
  .setAction(
    async (
      {
        name: smartWalletName,
        impl,
        beneficiary
      }: { name: string; impl: string; beneficiary: string },
      { ethers, deployResults }
    ) => {
      const [deployer] = await ethers.getSigners()
      const smartWallet = await ethers.getContractAt(
        'SmartWalletV3',
        deployResults[smartWalletName]
      )
      const smartWalletOwner = new ethers.Wallet(
        process.env.PRIVATE_KEY as string,
        ethers.provider
      )
      assert(
        process.env.GUARDIAN_PRIVATE_KEY !== undefined,
        'undefined guardian private key to execute WA operations'
      )
      const guardian = new ethers.Wallet(
        process.env.GUARDIAN_PRIVATE_KEY as string,
        ethers.provider
      )
      assert(
        await smartWallet.isGuardian(guardian.address, false),
        'invalid guardian address'
      )
      const callData = smartWallet.interface.encodeFunctionData(
        'changeMasterCopy',
        [processAddressOrName(impl, deployResults)]
      )

      assert(
        (await smartWallet.getOwner()) === deployer.address,
        'only owner can upgrade'
      )
      const approvalOption = {
        validUntil: 0,
        salt: ethers.utils.randomBytes(32),
        action_type: ActionType.ChangeMasterCopy
      }
      const entryPoint = await ethers.getContractAt(
        'EntryPoint',
        deployResults.EntryPoint
      )
      // TODO(handle case when it is forward proxy)
      const curImpl = await smartWallet.getMasterCopy()
      const signedUserOp = await fillAndMultiSign(
        callData,
        smartWallet,
        smartWalletOwner,
        [
          { signer: smartWalletOwner },
          {
            signer: guardian
          }
        ],
        ethers.constants.AddressZero,
        curImpl, // impl
        approvalOption,
        entryPoint
      )
      // check before execution
      await entryPoint.callStatic
        .simulateValidation(signedUserOp)
        .catch(simulationResultCatch)

      await (
        await entryPoint.handleOps(
          [signedUserOp],
          beneficiary ?? deployer.address
        )
      ).wait()

      // TODO(validate after execution)
    }
  )

smartWalletScope
  .task(TASK_ADD_GUARDIANS)
  .addParam(
    'guardians',
    'list guardian addresses, split by comma',
    undefined,
    types.string
  )
  .addOptionalParam(
    'name',
    'name of new-created smart wallet',
    'smartWallet',
    types.string
  )
  .setAction(
    async (
      {
        name: smartWalletName,
        guardians: guardiansArg
      }: { name: string; guardians: string },
      { ethers, deployResults }
    ) => {
      const smartWallet = await ethers.getContractAt(
        'SmartWalletV3',
        deployResults[smartWalletName]
      )
      const guardians = guardiansArg.split(',')
      for (const guardian of guardians) {
        await (await smartWallet.addGuardian(guardian)).wait()
      }
    }
  )
