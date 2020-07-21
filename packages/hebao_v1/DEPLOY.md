## deploy hebao contracts

### deploy to goerli testnet:

Sample: deploy release-1.1.3 to goerli testnet:

```bash
   cd $hebao_v1/deployment
   mkdir 1.1.3  # mkdir for the release
   ./flatten-all 1.1.3  # flatten all the contracts to 1.1.3
   ./build-all-flattened 1.1.3 # build all flattened contract to 1.1.3/build

   # check deployer-goerli.js, execute batchDeploySimpleContracts() function:
   node deployer-goerli.js 1.1.3

```
