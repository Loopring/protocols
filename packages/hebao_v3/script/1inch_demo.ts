import { ethers } from 'hardhat'

async function main(): Promise<void> {
  const { chainId } = await ethers.provider.getNetwork()
  const apiBaseUrl = 'https://api.1inch.dev/swap/v5.2/' + chainId
  const methodName = '/swap'
  const walletAddress = '0xf848E69EA6e206E6e8F2fBFc46ddd27C73907979'
  const headers = {
    headers: {
      Authorization: 'WOQAjIX5hCuXb879RVqvPYjkxD8cT23s',
      accept: 'application/json'
    }
  }
  const swapParam = {
    fromTokenAddress: '0x111111111117dc0aa78b770fa6a738034120c302', // 1INCH
    toTokenAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
    amount: '100000000000000000',
    fromAddress: walletAddress,
    slippage: '1',
    disableEstimate: 'false',
    allowPartialFill: 'false'
  }
  const url =
    apiBaseUrl +
    methodName +
    '?' +
    new URLSearchParams(swapParam).toString()
  const res = await fetch(url, headers)
  console.log(await res.json())
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
