import { BigNumberish, Wallet } from 'ethers'

export async function signCreateWallet (
  moduleAddress: string,
  owner: Wallet,
  guardians: string[],
  quota: BigNumberish,
  inheritor: string,
  feeRecipient: string,
  feeToken: string,
  maxFeeAmount: BigNumberish,
  salt: BigNumberish,
  chainId: number
): Promise<string> {
  const domain = {
    name: 'WalletFactory',
    version: '2.0.0',
    chainId,
    verifyingContract: moduleAddress
  }

  const types = {
    createWallet: [
      { name: 'owner', type: 'address' },
      { name: 'guardians', type: 'address[]' },
      { name: 'quota', type: 'uint256' },
      { name: 'inheritor', type: 'address' },
      { name: 'feeRecipient', type: 'address' },
      { name: 'feeToken', type: 'address' },
      { name: 'maxFeeAmount', type: 'uint256' },
      { name: 'salt', type: 'uint256' }
    ]
  }
  const message = {
    types,
    domain,
    primaryType: 'createWallet',
    value: {
      owner: owner.address,
      guardians,
      quota,
      inheritor,
      feeRecipient,
      feeToken,
      maxFeeAmount,
      salt
    }
  }

  return await owner._signTypedData(
    message.domain,
    message.types,
    message.value
  )
}
