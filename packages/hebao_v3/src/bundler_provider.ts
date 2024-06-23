import { type JsonRpcProvider } from '@ethersproject/providers'
import { ethers } from 'hardhat'
import { type UserOperation, deepHexlify } from 'src/aa_utils'

export class HttpRpcClient {
  private readonly userOpJsonRpcProvider: JsonRpcProvider

  initializing: Promise<void>

  constructor(
    readonly bundlerUrl: string,
    readonly entryPointAddress: string,
    readonly chainId: number
  ) {
    this.userOpJsonRpcProvider = new ethers.providers.JsonRpcProvider(
      this.bundlerUrl,
      {
        name: 'Connected bundler network',
        chainId
      }
    )
    this.initializing = this.validateChainId()
  }

  async validateChainId(): Promise<void> {
    // validate chainId is in sync with expected chainid
    const chain = await this.userOpJsonRpcProvider.send(
      'eth_chainId',
      []
    )
    const bundlerChain = parseInt(chain)
    if (bundlerChain !== this.chainId) {
      throw new Error(
        `bundler ${this.bundlerUrl} is on chainId ${bundlerChain}, but provider is on chainId ${this.chainId}`
      )
    }
  }

  /**
   * send a UserOperation to the bundler
   * @param userOp1
   * @return userOpHash the id of this operation, for getUserOperationTransaction
   */
  async sendUserOpToBundler(userOp1: UserOperation): Promise<string> {
    await this.initializing
    const hexifiedUserOp = deepHexlify(userOp1)
    const jsonRequestData: [UserOperation, string] = [
      hexifiedUserOp,
      this.entryPointAddress
    ]
    await this.printUserOperation(
      'eth_sendUserOperation',
      jsonRequestData
    )
    return await this.userOpJsonRpcProvider.send(
      'eth_sendUserOperation',
      [hexifiedUserOp, this.entryPointAddress]
    )
  }

  /**
   * estimate gas requirements for UserOperation
   * @param userOp1
   * @returns latest gas suggestions made by the bundler.
   */
  async estimateUserOpGas(userOp1: Partial<UserOperation>): Promise<{
    callGasLimit: number
    preVerificationGas: number
    verificationGasLimit: number
  }> {
    await this.initializing
    const hexifiedUserOp = deepHexlify(userOp1)
    const jsonRequestData: [UserOperation, string] = [
      hexifiedUserOp,
      this.entryPointAddress
    ]
    await this.printUserOperation(
      'eth_estimateUserOperationGas',
      jsonRequestData
    )
    return await this.userOpJsonRpcProvider.send(
      'eth_estimateUserOperationGas',
      [hexifiedUserOp, this.entryPointAddress]
    )
  }

  private async printUserOperation(
    method: string,
    [userOp, entryPointAddress]: [UserOperation, string]
  ): Promise<void> {
    console.log(
      'sending',
      method,
      {
        ...userOp
        // initCode: (userOp.initCode ?? '').length,
        // callData: (userOp.callData ?? '').length
      },
      entryPointAddress
    )
  }

  // async getUserOpReceipt(userOpHash: string): Promise<string> {
  // return await this.userOpJsonRpcProvider.send(
  // 'eth_getUserOperationReceipt',
  // [userOpHash]
  // )
  // }

  async getUserOpReceipt(
    userOpHash: string,
    timeout = 60000,
    interval = 5000
  ): Promise<string | null> {
    const entryPointView = await ethers.getContractAt(
      'EntryPoint',
      this.entryPointAddress
    )
    const endtime = Date.now() + timeout
    while (Date.now() < endtime) {
      const events = await entryPointView.queryFilter(
        entryPointView.filters.UserOperationEvent(userOpHash)
      )
      if (events.length > 0) {
        return events[0].transactionHash
      }
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
    return null
  }
}
