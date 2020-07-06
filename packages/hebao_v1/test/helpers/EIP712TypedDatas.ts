export interface WalletCreation {
  owner: string;
  label: string;
  labelApproval: string;
  modules: string[];
}

// export function walletCreationTypedData(obj: WalletCreation) {
//   const typedData = {
//     types: {
//       EIP712Domain: [
//         { name: "name", type: "string" },
//         { name: "version", type: "string" },
//         { name: "chainId", type: "uint256" },
//         { name: "verifyingContract", type: "address" }
//       ],
//       MetaTx: [
//         { name: "owner", type: "address" },
//         { name: "label", type: "string" },
//         { name: "labelApproval", type: "bytes" },
//         { name: "modules", type: "address[]" }
//       ]
//     },
//     primaryType: "MetaTx",
//     domain: {
//       name: "Loopring Wallet MetaTx",
//       version: "2.0",
//       chainId: new BN(metaTx.chainId),
//       verifyingContract: Constants.zeroAddress
//     },
//     message: {
//       from: metaTx.from,
//       to: metaTx.to,
//       nonce: new BN(metaTx.nonce),
//       gasToken: metaTx.gasToken,
//       gasPrice: metaTx.gasPrice,
//       gasLimit: new BN(metaTx.gasLimit),
//       txAwareHash: metaTx.txAwareHash,
//       data: metaTx.data
//     }
//   };
//   return typedData;
// }
