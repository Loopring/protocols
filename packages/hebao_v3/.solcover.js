module.exports = {
  skipFiles: [
    'account-abstraction/test',
    'account-abstraction/samples/bls/lib',
    //solc-coverage fails to compile our Manager module.
    'account-abstraction/samples/gnosis',
    'account-abstraction/utils/Exec.sol',
    'test'
  ],
  configureYulOptimizer: true
}
