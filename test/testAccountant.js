
const abi = require("ethereumjs-abi");
const ethUtil = require("ethereumjs-util");


const AccountantImpl = artifacts.require("./AccountantImpl.sol")

contract("AccountantImpl", (accounts) => {

  const owner = accounts[0];
  const accountantImpl = AccountantImpl.at(AccountantImpl.address);

  describe("AccountantImpl functionalities:", () => {
    it("TestCase1: constructor init", async () => {
      const accountant0 = await accountantImpl.queryAccountant(0);
      console.log("constructor init accountants list:");
      console.log(accountant0);
    });

    it("TestCase2: submitBlock", async () => {
      var submitter = "0xb8492cecfe3a04a8d969bdbbf5962be8a1ebb418";
      var rootNum = 12345678;
      var seqNos = [0];
      var oldAccountants = ["0x8a4c031e0f090f32617fd456694cad979b7fc66c"];
      var newAccountants = ["0x0f836425c0f0b0f744d919bbd720c4194ad2c75f"];
      var height = 100;
      var rootBefore = await accountantImpl.queryMerkleRoot(height);
      console.log(rootBefore);

      var hash = await accountantImpl.getHash(submitter, rootNum, seqNos, oldAccountants, newAccountants, height);
      console.log(hash); 
      var privateKey0 = "1876a1d19112f84c14ee319675dc30303f11ab95beafdd616072f72689a2f083";
      const finalTypes0 = ["bytes32"];
      const finalValues0 = [];
      finalValues0.push(hash);
      const signature0 = ethUtil.ecsign(abi.soliditySHA3(finalTypes0, finalValues0), new Buffer(privateKey0, 'hex')); 
      console.log(signature0);
      const addrSign = ethUtil.ecrecover(abi.soliditySHA3(finalTypes0, finalValues0), signature0.v, signature0.r, signature0.s);
      console.log(addrSign);

      
      console.log(ethUtil.publicToAddress(addrSign, false));
      console.log(ethUtil.bufferToHex(Buffer.concat([ethUtil.toBuffer(signature0.v), signature0.r, signature0.s])));
      //signatures.push(ethUtil.bufferToHex(Buffer.concat([ethUtil.toBuffer(signature0.v), signature0.r, signature0.s]));

      var signatures = "0x1ca3c1ba71301f01e6b35d8fdf5d247a67d07d79fe98a2ce4dbfd75733e8cd502b0c550e4f3e4b5bae3b9d1b787c63e45f77a4fcf9bd5ca775d630e639cfcfc178";
      /*string sig0 = "";
      public addNumber(x: number, numBytes = 4, forceAppend = true) {
        // Check if we need to encode this number as negative
        if (x < 0) {
          const encoded = abi.rawEncode(["int256"], [x.toString(10)]);
          const hex = encoded.toString("hex").slice(-(numBytes * 2));
          return this.addHex(hex, forceAppend);
        } else {
          return this.addBigNumber(new BigNumber(x), numBytes, forceAppend);
        }
      }*/

      /*await accountantImpl.setSigLength(hexString, {from: owner});
      var sigLength = await accountantImpl.getSigLength();
      console.log("sigLength: ");
      console.log(sigLength);
      var r = await accountantImpl.getR();
      console.log(r);
      var s = await accountantImpl.getS();
      console.log(s);
      var v = await accountantImpl.getSig();
      console.log(v);*/
      await accountantImpl.submitBlock(submitter, rootNum, seqNos, oldAccountants, newAccountants, height, signatures, {from: owner});
      /*const accountant0After = await accountantImpl.queryAccountant(0);
      const accountant1After = await accountantImpl.queryAccountant(1);
      console.log("submitBlock list:");
      console.log(accountant0After);
      console.log(accountant1After);
      var rootAfter = await accountantImpl.queryMerkleRoot(height);
      console.log(rootAfter);
      var hashPackage = await accountantImpl.getPackage(submitter, rootNum, seqNos, oldAccountants, newAccountants, height);
      console.log(hashPackage);


      const privateKey = ethUtil.sha3("any strings");
      const address = ethUtil.bufferToHex(ethUtil.privateToAddress(privateKey));

      const finalTypes = ["bytes32"];
      const finalValues = [];
      finalValues.push(hash);

      const signature = ethUtil.ecsign(abi.soliditySHA3(finalTypes, finalValues), privateKey);
      console.log(signature);
      
      const sig = "0x" + "27" + "A1".repeat(32) + "B2".repeat(32) + "28" + "C3".repeat(32) + "D4".repeat(32);
      var parseSig = await accountantImpl.parseSignatures(sig, 2);
      console.log(parseSig);*/

    });

    /*it("TestCase3: withdraw", async () => {
      var height = 100;
      const rawData = "0x" + "0074" + "A1".repeat(20) + "00".repeat(31) + "01" + "B2".repeat(32); 
      const path = "0x" + "C3".repeat(32) + "D4".repeat(32);
      await accountantImpl.withdraw(height, rawData, [1,2]);
      var heightStore = await accountantImpl.queryHeight(); 
      console.log(heightStore);
      var tokenStore = await accountantImpl.queryToken();
      console.log(tokenStore);
      var toStore = await accountantImpl.queryTo();
      console.log(toStore);
      var amountStore = await accountantImpl.queryAmount();  
      console.log(amountStore); 
    });*/

  });

});