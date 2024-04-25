# Hebao Smart Wallet Contracts

_[hebao]_(荷包）means wallet in China -- see https://www.pinterest.com/pin/373376625330954965 for examples.

# Build

```
yarn install
```

# Run test

```
yarn test
```

# Deploy

```
# deploy new implementation of smart wallet
yarn hardhat run ./scripts/deploy_impl.ts --network ${NETWORK}

# deploy official guardians
yarn hardhat run ./scripts/deploy_official_guardian.ts --network ${NETWORK}
```
