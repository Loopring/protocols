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

  const encodedLabel = ethUtil.keccak(Buffer.from(label, "utf8"));
  const encodedApproval = ethUtil.keccak(labelApproval);
  const encodedModules = ethUtil.keccak(
    web3.eth.abi.encodeParameter("address[]", modules)
  );

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

  const domainSeprator = getMetaTxDomainSeprator(moduleAddress);

  const hash = ethUtil.keccak(
    Buffer.concat([
      Buffer.from(EIP191_HEADER, "utf8"),
      domainSeprator,
      ethUtil.keccak(encodedRequest)
    ])
  );

  return sign(owner, hash);
}
