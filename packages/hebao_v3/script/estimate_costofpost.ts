import { testExecuteTxWithUSDCPaymaster } from './demo_utils'
import { deployAll } from './deploy_utils'
import { type Log } from '@ethersproject/abstract-provider'
import { type Interface, type Result } from '@ethersproject/abi'
import {
  LoopringPaymaster__factory,
  EntryPoint__factory
} from '../typechain-types'

function getEventArgs(
  logs: Log[],
  eventName: string,
  iface: Interface
): Result {
  const topic = iface.getEventTopic(eventName)
  // only parse the first one
  return iface.parseLog(logs.find((log) => log.topics[0] === topic)!)
    .args
}

// find out the best cost_of_post value used in paymaster
async function main(): Promise<void> {
  // send userop using paymaster and check emitted events:
  // PaymasterEvent and UserOperationEvent, then check actualTokenCost
  // value between them
  const fixture = await deployAll()
  const receipt = await testExecuteTxWithUSDCPaymaster(fixture)
  const useroperationEvent = getEventArgs(
    receipt.logs,
    'UserOperationEvent',
    EntryPoint__factory.createInterface()
  )
  const paymasterEvent = getEventArgs(
    receipt.logs,
    'PaymasterEvent',
    LoopringPaymaster__factory.createInterface()
  )
  console.log(
    paymasterEvent.actualETHCost,
    useroperationEvent.actualGasCost
  )
  // about 6k gas accounts for postop
  console.log(
    useroperationEvent.actualGasUsed.sub(
      paymasterEvent.actualETHCost
        .mul(useroperationEvent.actualGasUsed)
        .div(useroperationEvent.actualGasCost)
    )
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
