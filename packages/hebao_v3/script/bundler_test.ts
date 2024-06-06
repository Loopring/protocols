import axios from 'axios'
import { entrypointAddr } from 'src/constants'

async function main(): Promise<void> {
  const baseUrl = 'https://eth-sepolia.g.alchemy.com/v2'
  const apiKey = 'SNFvRbyJF_p1iea94S-Piy5fqNhALSVB'
  const url = `${baseUrl}/${apiKey}`

  // let entryPointAddress;
  // get entrypoints
  {
    const params = {
      id: 1,
      jsonrpc: '2.0',
      method: 'eth_supportedEntryPoints'
    }
    const { data } = await axios.post(url, JSON.stringify(params))
    const supportedEntryPoints = data.result
    console.log(supportedEntryPoints)
    // entryPointAddress = data.result
  }

  const signedUserop = {}
  // estimate gas
  {
    const params = {
      id: 1,
      jsonrpc: '2.0',
      method: 'eth_estimateUserOperationGas',
      params: [signedUserop, entrypointAddr]
    }
    const { data } = await axios.post(url, JSON.stringify(params))
    console.log(data.result)
  }
  // send userop
  {
    const params = {
      id: 1,
      jsonrpc: '2.0',
      method: 'eth_sendUserOperation',
      params: [signedUserop, entrypointAddr]
    }
    const { data } = await axios.post(url, JSON.stringify(params))
    console.log(data.result)
  }
}

main().catch(console.error)
