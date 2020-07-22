# Loopring Protocol (V3) using zkSNARKs

## About

This is a beta version of Loopring's order-based DEX protocol (version 3.0). The code base is still being audited and is not yet production ready.

To understand several concepts introduced by the Loopring Protocol, such as order-ring, ring-matching, dual-authoring, free-burning, please read our [whitepaper](https://loopring.org/resources/en_whitepaper.pdf) for Loopring Protocol 2.x.

To understand the overall design for Loopring 3.0, including Ethereum smart contracts and zkSNARKs circuits, please refer to the [DESIGN](https://github.com/Loopring/protocols/blob/master/packages/loopring_v3/DESIGN.md) doc. The design of the backend relayer system is and will not be covered by this document. We welcome any feedback regarding the design and our implementation, feel free to [email us](mailto:daniel@loopring.org) or submit pull requests.

### Performance

|                           | Loopring 2.x | Loopring 3.0 <br> (Rollup) | Loopring 3.0 <br> (Validium) |
| :------------------------ | :----------: | :------------------------: | :--------------------------: |
| Trades per Ethereum Block |      26      |           26300            |            216000            |
| Trades per Second         |      ~2      |            2025            |            16400             |
| Cost per Trade            | ~300,000 gas |          375 gas           |            47 gas            |

- _Cost in USD per Trade_ in the table does not cover off-chain proof generation.

## Top Features

- Onchain data-availability (DEXes can opt out for even greater throughput & lower cost)
- ERC20 tokens and Ether are supported by default
- Multiple on-chain DEX instances with isolated state and dedicated event stream (different from 2.0)
- Onchain deposit + on-chain & offchain withdrawal support
- Support offchain order cancellation and order time-to-live settings (inherited from 2.0)
- Allow partial order matching (aka partial fill) and offchain order-scaling (inherited from 2.0)
- Multiple circuit permutations for different request batch sizes
- Use tokens/ether traded as trading fee
- A built-in mechanism to force DEX operators to fulfill duties in time
- Support DEX operators to stake tokens to lower down protocol fees
- Support a unique feature called Order Aliasing (new to 3.0)
- 100% secure for end users, even when DEX operators are evil (same as 2.0)
- and more...

## Challenges

- SNARKs using groth16 require trusted setups

## Build

If you are using a Mac, you will need to (re）install the commandline tool:

```
	sudo rm -rf /Library/Developer/CommandLineTools
	xcode-select --install

```

Then you may also need to install "lgmpxx":

- Download the source from https://gmplib.org/download/gmp/gmp-6.2.0.tar.lz
- unzip it using (lzip - `brew install lzip`) :`tar -xf gmp-6.2.0.tar.lz`
- install it:

```
	./configure --prefix=/usr/local --enable-cxx
	make
	make check
	sudo make install
```

Please use node v10.

`npm run build // first time` or `npm run compile` or `npm run watch`.

### Circuits

The circuit tests can be run with `npm run testc`. A single test can be run with `npm run test-circuits <test_name>`.

## Run Unit Tests

- please make sure you run `npm run build` for the first time.
- run `npm run ganache` from project's root directory in terminal.
- run `npm run test` from project's root directory in another terminal window.
- run single test: `npm run test -- transpiled/test/xxx.js`
- print info logs in tests: `npm run test -- -i`
- print more detailed debug logs in tests: `npm run test -- -x`

Running all tests takes around 1 hour on a modern PC with a CPU with 4 cores. Creating proofs is computationaly heavy and takes time even when multi-threading is used. Run individual tests when you can.

Verifier/Prover keys are cached in the `keys` folder. When running `make` these keys are automatically deleted so they cannot be outdated.

## Contract Deployment

- development network: `npm run migrate-dev`
- ropsten network: `npm run migrate-ropsten`
- main network: `npm run migrate`

If you have installed truffle globally, you can run:

`npm run transpile && truffle migrate --network <network> --reset --dry-run`

Replace network with `development`, `live`, `ropsten`, `koven`, etc.

## Etherscan.io Code Verification

You can run `truffle-flattener <solidity-files>` to flatten a file. For contracts with constructor arguments, use https://abi.hashex.org/ to generated the argument string. To verify on etherscan.io, you also need to learn which libraries are linked to each contract from the migration scripts.
