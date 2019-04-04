# Loopring Protocol (V3) using zkSNARKs

## About
This is a very early version of Loopring's order-based DEX protocol (version 3.0). The code base is still being tested and is not production ready.

To understand several concepts introduced by the Loopring Protocol, such as order-ring, ring-matching, dual-authoring, fee-burning, please read our [whitepaper](https://loopring.org/resources/en_whitepaper.pdf) for Loopring Protocol 2.x.

To understand the overall design for Loopring 3.0, including Ethereum smart contracts and zkSNARKs circuits, please refer to the [DESIGN](https://github.com/Loopring/protocols/blob/master/packages/loopring_v3/DESIGN.md) doc. The design of the backend relayer system is and will not be covered by this document. We welcome any feedback regarding the design and our implementation, feel free to [email us](mailto:daniel@loopringlorg) or submit pull requests.

## Top Features

- Onchain data-availability (DEXes can opt out for even greater throughput & lower cost)
- All ERC20 tokens and Ether are supported by default
- Multiple on-chain DEX instances with isolated state and dedicated event stream (different from 2.0)
- Onchain deposit + on-chain & offchain withdrawal support
- Support offchain order cancellation and order time-to-lve settings (inherited from 2.0)
- Allow partial order matching (aka partial fill) and offchain order-scaling (inherited from 2.0)
- Multiple circuit permutations for different request batch sizes
- Use any ERC20 token or Ether as trading fee to reduce friction（inherited from 2.0)
- DEX can buy down fee token burn rate (inherited from 2.0)
- Enhanced version of dual authoring prevent orders/trades from being stolen by middleman (enhanced on top of 2.0)
- Greatly reduce gas fee for DEX settlement by 30x (with data-availability) or 200x (without data-availability) -- this may be optimized to 1000x in the near future.
- Built-in mechanism to force DEX operators to fulfill duties in time (especially for handling deposits and withdrawals)
- Support DEX operators to stake tokens to "buy" credit
- Support a "maintainance mode" for DEX operators to upgrade backends within a time window
- Support a unique feature called Order Aliasing (new to 3.0)
- 100% secure for end users, even when DEX operators are evil (same as 2.0)
- and more...

## Challanges

- SNARKs requires trusted setups
- Circuits not yet audited (smart contract auditing should be easy and we are very experienced)
- Can switch to better hash function
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
