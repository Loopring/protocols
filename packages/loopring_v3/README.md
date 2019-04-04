# Loopring Protocol (V3) using zkSNARKs

## About
This is a very early version of Loopring's order-based DEX protocol (version 3.0). The code base is still being tested and is not production ready.

To understand several concepts introduced by the Loopring Protocol, such as order-ring, ring-matching, dual-authoring, fee-burning, please read our [whitepaper](https://loopring.org/resources/en_whitepaper.pdf) for Loopring Protocol 2.x.

To understand the overall design for Loopring 3.0, including Ethereum smart contracts and zkSNARKs circuits, please refer to the [DESIGN](https://github.com/Loopring/protocols/blob/master/packages/loopring_v3/DESIGN.md) doc. The design of the backend relayer system is and will not be covered by this document. We welcome any feedback regarding the design and our implementation, feel free to [email us](mailto:daniel@loopringlorg) or submit pull requests.

## Top Features

- Onchain data-availability (DEXes can opt out for even greater throughput & lower cost)
- All ERC20 tokens and Ether are supported by default
- Multiple onchain DEX instances with isolated state and dedicated event stream (different from 2.0)
- Onchain deposits + onchain & offchain withdrawals support
- Very cheep offchain order cancellation as well as order time-to-lve support
- Allow partial order matching (partial fill) and offchain order-scaling
- Multiple circuit permutations for different request batch sizes
- Use any ERC20 token or Ether as trading fee to reduce friction（inherited from 2.0)
- DEX can buy down fee token burn rate (inherited from 2.0)
- Dual authoring support to prevent orders/trades from being stolen by middleman (inherit from 2.0)
- Greatly reduce gas fee for DEX settlement by 100x (with data-availability) or 1000x (without data-availability)
- 100% secure for end users, even when DEX operators are evil
- and more...

## Build

```
./install

make
npm run compile
```

## Run Unit Tests
* run `npm run ganache` from project's root directory in terminal.
* run `npm run test` from project's root directory in another terminal window.
* run single test: `npm run test -- transpiled/test/xxx.js`
* print info logs in tests: `npm run test -- -i`
* print more detailed debug logs in tests: `npm run test -- -x`
