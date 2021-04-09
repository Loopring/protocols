import { newWalletImpl } from "../test/commons";

// run with: npx hardhat run --network optimistic scripts/deploy-optimistic.ts
async function main() {
  const walletImpl = await newWalletImpl();
  console.log("walletImpl address:", walletImpl.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
