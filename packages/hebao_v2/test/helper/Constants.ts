export class Constants {
  static readonly emptyBytes: any = [];
  static readonly zeroAddress = "0x" + "00".repeat(20);
  static readonly emptyBytes32 = "0x" + "00".repeat(32);
  static readonly chainId = 31337; // hardhat & ganache default chainId

  // static readonly chainId = 42161; // Arbitrum One
  // static readonly chainId = 421611; // arbitrum testnet
  // static readonly chainId = 97; // binance bsc testnet chainId
}
