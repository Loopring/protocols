
enum TokenType {
  LRC = 0,
  ETH = 1,
  Other = 2,
}

export class Tax {

  public matchingConsumerLRC: number;
  public matchingConsumerETH: number;
  public matchingConsumerOther: number;
  public matchingIncomeLRC: number;
  public matchingIncomeETH: number;
  public matchingIncomeOther: number;
  public p2pConsumerLRC: number;
  public p2pConsumerETH: number;
  public p2pConsumerOther: number;
  public p2pIncomeLRC: number;
  public p2pIncomeETH: number;
  public p2pIncomeOther: number;
  public percentageBase: number;
  public lrcTokenAddress: string;
  public wethTokenAddress: string;

  constructor(matchingConsumerLRC: number,
              matchingConsumerETH: number,
              matchingConsumerOther: number,
              matchingIncomeLRC: number,
              matchingIncomeETH: number,
              matchingIncomeOther: number,
              p2pConsumerLRC: number,
              p2pConsumerETH: number,
              p2pConsumerOther: number,
              p2pIncomeLRC: number,
              p2pIncomeETH: number,
              p2pIncomeOther: number,
              percentageBase: number,
              lrcTokenAddress: string,
              wethTokenAddress: string) {
    this.matchingConsumerLRC = matchingConsumerLRC;
    this.matchingConsumerETH = matchingConsumerETH;
    this.matchingConsumerOther = matchingConsumerOther;
    this.matchingIncomeLRC = matchingIncomeLRC;
    this.matchingIncomeETH = matchingIncomeETH;
    this.matchingIncomeOther = matchingIncomeOther;
    this.p2pConsumerLRC = p2pConsumerLRC;
    this.p2pConsumerETH = p2pConsumerETH;
    this.p2pConsumerOther = p2pConsumerOther;
    this.p2pIncomeLRC = p2pIncomeLRC;
    this.p2pIncomeETH = p2pIncomeETH;
    this.p2pIncomeOther = p2pIncomeOther;
    this.percentageBase = percentageBase;
    this.lrcTokenAddress = lrcTokenAddress;
    this.wethTokenAddress = wethTokenAddress;
  }

  public calculateTax(token: string, income: boolean, P2P: boolean, amount: number) {
    if (amount === 0) {
      return 0;
    }
    const taxRate = this.getTaxRate(token, income, P2P);
    return Math.floor(amount * taxRate / this.percentageBase);
  }

  public getTaxRate(token: string, income: boolean, P2P: boolean) {
    const tokenType = this.getTokenType(token);
    if (P2P) {
      if (income) {
        const taxes = [this.p2pIncomeLRC, this.p2pIncomeETH, this.p2pIncomeOther];
        return taxes[tokenType];
      } else {
        const taxes = [this.p2pConsumerLRC, this.p2pConsumerETH, this.p2pConsumerOther];
        return taxes[tokenType];
      }
    } else {
      if (income) {
        const taxes = [this.matchingIncomeLRC, this.matchingIncomeETH, this.matchingIncomeOther];
        return taxes[tokenType];
      } else {
        const taxes = [this.matchingConsumerLRC, this.matchingConsumerETH, this.matchingConsumerOther];
        return taxes[tokenType];
      }
    }
  }

  private getTokenType(token: string) {
    if (token === this.lrcTokenAddress) {
      return TokenType.LRC;
    } else if (token === this.wethTokenAddress) {
      return TokenType.ETH;
    } else {
      return TokenType.Other;
    }
  }

}
