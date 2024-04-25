# Hebao Smart Wallet Contracts

_[hebao]_(荷包）means wallet in China -- see https://www.pinterest.com/pin/373376625330954965 for examples.

# Build

```
yarn install
yarn compile
```

# Run test

```
yarn test
```

# Deploy

```
# deploy wallet factory with the same address
# modify config.json, set new impl address will to use, make sure create2 contract is deployed already
# and all these operators will be added to wallet factory
yarn hardhat run scripts/deploy_walletfactory.ts --network ${NETWORK}
```
