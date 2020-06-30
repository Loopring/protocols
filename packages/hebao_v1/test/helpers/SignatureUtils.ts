import ethUtil = require("ethereumjs-util");
import { sign, SignatureType } from "./Signature";

const EIP191_HEADER = "\x19\x01";
const CHAIN_ID = 1;
const EIP712_DOMAIN_TYPEHASH = ethUtil.keccak(
  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

export function getMetaTxDomainSeprator(moduleAddress: string) {
  const domainEncoded = web3.eth.abi.encodeParameters(
    ["bytes32", "bytes32", "bytes32", "uint256", "address"],
    [
      EIP712_DOMAIN_TYPEHASH,
      ethUtil.keccak("MetaTxModule"),
      ethUtil.keccak("2.0"),
      CHAIN_ID,
      moduleAddress
    ]
  );

  return ethUtil.keccak(domainEncoded);
}

export function signCreateWallet(
  moduleAddress: string,
  owner: string,
  label: string,
  labelApproval: string,
  modules: string[]
) {
  const TYPE_STR =
    "createWallet(address owner,string label,bytes labelApproval,address[] modules)";
  const CREATE_WALLET_TYPEHASH = ethUtil.keccak(Buffer.from(TYPE_STR));
  // console.log(`CREATE_WALLET_TYPEHASH: ${CREATE_WALLET_TYPEHASH.toString("hex")}`);

  console.log(`labelApproval: ${labelApproval}`);
  const encodedLabel = ethUtil.keccak(Buffer.from(label, "utf8"));
  const encodedApproval = ethUtil.keccak(labelApproval);
  const encodedModules = ethUtil.keccak(
    web3.eth.abi.encodeParameter("address[]", modules)
  );

  console.log(`encodedApproval: ${encodedApproval.toString("hex")}`);
  console.log(`encodedModules: ${encodedModules.toString("hex")}`);

  const encodedRequest = web3.eth.abi.encodeParameters(
    ["bytes32", "address", "bytes32", "bytes32", "bytes32"],
    [
      CREATE_WALLET_TYPEHASH,
      owner,
      encodedLabel,
      encodedApproval,
      encodedModules
    ]
  );
  // console.log(`encodedRequest: ${encodedRequest}`);

  const domainSeprator = getMetaTxDomainSeprator(moduleAddress);
  // console.log(`domainSeprator: ${domainSeprator.toString("hex")}`);

  const hash = ethUtil.keccak(
    [
      Buffer.from(EIP191_HEADER, "utf8"),
      Buffer.from(domainSeprator.slice(2), "hex"),
      Buffer.from(ethUtil.keccak(encodedRequest).slice(2), "hex")
    ].reduce((a: Uint8Array[], b: Uint8Array[]) => Buffer.concat(a, b))
  );
  console.log(`hash: ${hash}`);

  return sign(owner, Buffer.from(hash.slice(2), "hex"));
}
