## deploy hebao contracts

### deploy to goerli testnet:

Sample: deploy release-1.1.2 to goerli testnet:

```bash
   cd $hebao_v1/deployment
   mkdir 1.1.2  # mkdir for the release
   ./flatten-all 1.1.2  # flatten all the contracts to 1.1.2
   ./build-all-flattened 1.1.2 # build all flattened contract to 1.1.2/build


```
