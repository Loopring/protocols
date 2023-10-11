import { Contract, Signer } from "ethers";
import { ethers } from "hardhat";

export const getVerifiedContractAt = (address: string, signer?: Signer): Promise<Contract> => {
  // @ts-ignore
  return ethers.getVerifiedContractAt(address)
  .then((contract: Contract) => {
    return signer ? contract.connect(signer) : contract;
  })
} 