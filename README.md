# truffle-init-webpack
Example webpack project with Truffle. Includes contracts, migrations, tests, user interface and webpack build pipeline.

## Usage

To initialize a project with this exapmple, run `truffle init webpack` inside an empty directory.

## Building and the frontend

1. First run `npm install` to install node_modules.
2. Then run `truffle compile`, then run `truffle migrate` to deploy the contracts onto your network of choice (default "development").
3. Then run `npm run dev` to build the app and serve it on http://localhost:8080

## Run tests

1. run `./testrpc.sh` in terminal
2. run `truffle test` in another terminal to execute tests.

## Possible upgrades

* Use the webpack hotloader to sense when contracts or javascript have been recompiled and rebuild the application. Contributions welcome!

## Common Errors

* **Error: Can't resolve '../build/contracts/LoopringToken.json'**

This means you haven't compiled or migrated your contracts yet. Run `truffle compile` and `truffle migrate` first.

Full error:

```
ERROR in ./app/main.js
Module not found: Error: Can't resolve '../build/contracts/LoopringToken.json' in '/Users/tim/Documents/workspace/Consensys/test3/app'
 @ ./app/main.js 11:16-59
```
