# Loopring Protocol Smart Contracts

## Compile


If you are using Windows:
```
npm install --global --production windows-build-tools
```

Then run the following commands from project's root directory:
 
```
npm install
npm run compile
```

## Deployed addresses on main-net:  
    * creater: 0x6d4ee35D70AD6331000E370F079aD7df52E75005  
    * TokenRegistry: 0x974e1e639b5a3c5f44909E1959Ab786AF21B7086  
    * TokenTransferDelegate: 0x450D10A0C61f2b007384128B626F28b757A75e49  
    * RinghashRegistry: 0xeE445e921F481c04A5d254A7F8f013F48A6f0947  
    * LoopringProtocolImpl:  0x03E0F73A93993E5101362656Af1162eD80FB54F2  
    * TransferableMultsig:  0x7421ad9C880eDF007a122f119AD12dEd5f7C123B  
   
## Run Unit Tests  
* run `npm run testrpc` from project's root directory in terminal.  
* run `npm run test` from project's root directory in another terminal window.  
* run single test: `npm run test -- transpiled/test/xxx.js`

## Run Unit Tests inside Docker

If you prefer to use docker, you can install docker first, then run the following:

```
npm run docker
```

If you do not have node/npm installed but still wish to use docker, you can run the commands manually:

```
docker-compose up --build --abort-on-container-exit
docker-compose logs -f test
```

The logs command is optional but will give you an easy to read output of the tests without the output from testrpc mixed in (though the combination of both is good for debugging and is why they're not being silenced.)
