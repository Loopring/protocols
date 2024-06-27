# Hebao Smart Wallet Contracts

_[hebao]_(荷包）means wallet in China -- see https://www.pinterest.com/pin/373376625330954965 for examples.

# Build

```
yarn install && yarn hardhat compile
```

# Run test

```
yarn test
```

# Tools

```
# deploy smartwallet and paymaster
bash ./tools/deploy.sh

# prepare tokens for paymaster and create new wallet
bash ./tools/prepare.sh

# upgrade wallet to new implementation
bash ./tools/upgrade_impl.sh
```
