## Prerequisites
1. nodejs, and make sure it's version above 8.0.0
2. npm
3. truffle

## Build
1. First run `npm install` to install node_modules.
2. Then run `truffle compile`
3. Run `truffle migrate` to deploy the contracts onto your network of choice (default "development").

## Run tests
1. git checkout unit-test
2. run `./testrpc.sh` in terminal
3. run `truffle test` in another terminal to execute tests.

## Common Errors

* **Error:  Can't resolve '../build/contracts/LoopringToken.json'**

This means you haven't compiled or migrated your contracts yet. Run `truffle compile` and `truffle migrate` first.

Full error:

```
ERROR in ./app/main.js
Module not found: Error: Can't resolve '../build/contracts/LoopringToken.json' in '/Users/tim/Documents/workspace/Consensys/test3/app'
 @ ./app/main.js 11:16-59
```

* **Error: "/usr/bin/env: node: No such file or directory"** 

If you have installed nodejs from your package repo in ubuntu it is called nodejs and not node.
You can solve it whit a symlink creation:

```
ln -s /usr/bin/nodejs /usr/local/bin/node
```

* **Error: "TypeError: this is not a typed array" or "TypeError: path must be a string"**

Check your node version, and upgrade it if under 8.0.0

e.g. install node 8._ in Ubuntu:

```
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt-get install -y nodejs
```
