# Loopring Protocol (V3) using zkSNARKs

## About

This is a very early version of Loopring's order-based DEX protocol (version 3.0). The code base is still being tested and is not production ready.

To understand several concepts introduced by the Loopring Protocol, such as order-ring, ring-matching, dual-authoring, free-burning, please read our [whitepaper](https://loopring.org/resources/en_whitepaper.pdf) for Loopring Protocol 2.x.

To understand the overall design for Loopring 3.0, including Ethereum smart contracts and zkSNARKs circuits, please refer to the [DESIGN](https://github.com/Loopring/protocols/blob/master/packages/loopring_v3/DESIGN.md) doc. The design of the backend relayer system is and will not be covered by this document. We welcome any feedback regarding the design and our implementation, feel free to [email us](mailto:daniel@loopring.org) or submit pull requests.

### Performance

|  | Loopring 2.x | Loopring 3.0 <br> (w/ Data Availability) | Loopring 3.0 <br> (w/o Data Availability)  |
| :----- |:-------------: |:---------------:| :-------------:|
| Trades per Ethereum Block | 26      | 5350 |      92000|
| Trades per Second | 2      | 350        |           6150 |
| Cost per Trade | 300,000 gas | 1500 gas | 87 gas|

After Istanbul:

|  | Loopring 2.x | Loopring 3.0 <br> (w/ Data Availability) | Loopring 3.0 <br> (w/o Data Availability)  |
| :----- |:-------------: |:---------------:| :-------------:|
| Trades per Ethereum Block | 26      | 20800 |      140000|
| Trades per Second | 2      | 1400        |           9350 |
| Cost per Trade | 300,000 gas | 385 gas | 57 gas|

* *Cost in USD per Trade* in the table does not cover off-chain proof generation.

## Top Features

- Onchain data-availability (DEXes can opt out for even greater throughput & lower cost)
- All ERC20 tokens and Ether are supported by default
- Multiple on-chain DEX instances with isolated state and dedicated event stream (different from 2.0)
- Onchain deposit + on-chain & offchain withdrawal support
- Support offchain order cancellation and order time-to-live settings (inherited from 2.0)
- Allow partial order matching (aka partial fill) and offchain order-scaling (inherited from 2.0)
- Multiple circuit permutations for different request batch sizes
- Use any ERC20 token or Ether as the trading fee to reduce friction（inherited from 2.0)
- DEX can buy down fee token burn rate (inherited from 2.0)
- An enhanced version of dual authoring prevent orders/trades from being stolen by a middleman (enhanced on top of 2.0)
- On current Ethereum mainnet, throughput is about 60 trades/second with on-chain data-availability, and ~350 trades/second without data-availability -- which can be further optimized in the near future.
- A built-in mechanism to force DEX operators to fulfill duties in time (especially for handling deposits and withdrawals)
- Support DEX operators to stake tokens to "buy" credit
- Support a "maintenance mode" for DEX operators to upgrade backends within a time window
- Support a unique feature called Order Aliasing (new to 3.0)
- 100% secure for end users, even when DEX operators are evil (same as 2.0)
- and more...

## Challenges

- SNARKs require trusted setups
- Circuits not yet audited (smart contract auditing should be easy and we are very experienced)
- Can switch to better hash function
- and more...

## Build

`npm run build // first time` or `npm run compile` or `npm run watch`.

### Circuits

The code of our circuits is currently not open source. If you have access to the private repo `protocol3-circuits` please clone it and update the `circuit_src_folder` variable in `circuit/CMakeLists.txt` so it points to the correct folder.

```
make
```

## Run Unit Tests

- run `npm run ganache` from project's root directory in terminal.
- run `npm run test` from project's root directory in another terminal window.
- run single test: `npm run test -- transpiled/test/xxx.js`
- print info logs in tests: `npm run test -- -i`
- print more detailed debug logs in tests: `npm run test -- -x`

Running all tests takes around 3 hours on a modern PC with a CPU with 4 cores. Creating proofs is computationaly heavy and takes time even when multi-threading is used. Run individual tests when you can.

Verifier/Prover keys are cached in the `keys` folder. When updating the circuits make sure to delete the keys of older circuit versions because this is not automatically detected.

## Contract Deployment

It's recommended to deploy the protocol with **UpgradeabilityProxy**. For more information, please see https://blog.openzeppelin.com/upgradeability-using-unstructured-storage and https://github.com/OpenZeppelin/openzeppelin-labs/tree/master/upgradeability_using_unstructured_storage.
