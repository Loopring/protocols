import abi = require("ethereumjs-abi");
import ethUtil = require("ethereumjs-util");
import pjs = require("protocol2-js");
import { Bitstream, SignAlgorithm } from "protocol2-js";

const MultihashUtilProxy = artifacts.require("MultihashUtilProxy");

contract("EIP712", (accounts: string[]) => {

  const prifix = "\x19\x01Ethereum Signed Message:\n32";
  const hash1 = "0x" + "A1".repeat(32);
  const order712Hash = "0x0b3a9aa63e45a75938e08ba08b7476d65203e0d44dfbe2739f8b15239abc2719";

  let multihash: any;
  before(async () => {
    multihash = await MultihashUtilProxy.new();
  });

  describe("General", () => {

    it("should be able to verify signed data", async () => {

      const domainTypes = ["bytes32", "bytes32", "bytes32"];
      const domainValues = [];
      domainValues.push(ethUtil.sha3("EIP712Domain(string name,string version)"));
      domainValues.push(ethUtil.sha3(new Buffer("Loopring Protocal", "utf8")));
      domainValues.push(ethUtil.sha3(new Buffer("2", "utf8")));

      const finalTypes = ["string", "bytes32", "bytes32"];
      const finalValues = [];
      finalValues.push(prifix);
      finalValues.push(ethUtil.bufferToHex(ethUtil.sha3(abi.rawEncode(domainTypes, domainValues))));
      finalValues.push(order712Hash);

      const privateKey = ethUtil.sha3("any strings");
      const address = ethUtil.bufferToHex(ethUtil.privateToAddress(privateKey));
      const signature = ethUtil.ecsign(abi.soliditySHA3(finalTypes, finalValues), privateKey);

      const sig = new Bitstream();
      sig.addNumber(SignAlgorithm.EIP712, 1);
      sig.addNumber(1 + 32 + 32, 1);
      sig.addNumber(signature.v, 1);
      sig.addHex(ethUtil.bufferToHex(signature.r));
      sig.addHex(ethUtil.bufferToHex(signature.s));

      const success = await multihash.verifySignature(address, hash1, sig.getData());
      assert(success, "Signature should be valid");
    });

  });

});
