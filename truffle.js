// Allows us to use ES6 in our migrations and tests.
require('babel-register')

module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*' // Match any network id
    },
	  live: {
      host: 'localhost', // Random IP for example purposes (do not use)
      port: 8545,
      network_id: 1, // Ethereum public network
      from: '0xdFCA9bF60785A5651b4262755cA60d48EFe6E3CF',
      gas: 2000000
      // optional config values:
      // 		gas
      // 		gasPrice
      // 		provider - web3 provider instance Truffle should use to talk to the Ethereum network.
      //          - if specified, host and port are ignored.
    }
  }
}
