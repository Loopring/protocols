# Loopring protocol using zk-SNARKs

## Building

Before building (not just the first time, also after a git pull) retrieve the source code for the dependencies:

    git submodule update --init --remote --merge --recursive

If you are using Linux:

    ./install_dependencies_linux.sh

If you are using Mac:

    ./install_dependencies_mac.sh

Run the following commands from the project's root directory:

```
make
npm install
npm run compile
```

## Run Unit Tests
* run `npm run ganache` from project's root directory in terminal.
* run `npm run test` from project's root directory in another terminal window.
* run single test: `npm run test -- transpiled/test/xxx.js`
* print info logs in tests: `npm run test -- -i`
* print more detailed debug logs in tests: `npm run test -- -x`
