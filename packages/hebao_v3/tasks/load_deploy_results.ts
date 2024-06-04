import { extendEnvironment } from 'hardhat/config'
import { loadDeployResult } from 'src/deploy_utils'

import 'hardhat/types/runtime'

declare module 'hardhat/types/runtime' {
  interface HardhatRuntimeEnvironment {
    // We omit the ethers field because it is redundant.
    deployResults: Record<string, string>
  }
}
extendEnvironment((hre) => {
  const deployResults: Record<string, string> = loadDeployResult(
    hre.network.name
  )
  hre.deployResults = deployResults
})
