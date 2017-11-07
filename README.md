# Loopring Protocol Smart Contracts

## Lint Solidity Files

```
npm install -g solium
solium --dir contracts
```

## Compile


If you are using Windows:
```
npm install --global --production windows-build-tools
```

Then run the following commands from project's root directory:
 
```
npm install -g truffle@4.0.1
npm install -g ethereumjs-testrpc@6.0.1
npm install -g typescript@2.4.2
npm install
npm run compile
```
    
## Run Unit Tests  
* run `npm run testrpc` from project's root directory in terminal.  
* run `npm run test` from project's root directory in another terminal window.  
