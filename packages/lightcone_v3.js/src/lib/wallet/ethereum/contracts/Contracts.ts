import Contract from "./Contract";

import erc20Abi from "../../config/abis/erc20.json";
import wethAbi from "../../config/abis/weth.json";
import airdropAbi from "../../config/abis/airdrop.json";
import exchangeAbi from "../../config/abis/exchange.json";

const WETH = new Contract(wethAbi);
const ERC20Token = new Contract(erc20Abi);
const AirdropContract = new Contract(airdropAbi);
const ExchangeContract = new Contract(exchangeAbi);

export default {
  ERC20Token,
  WETH,
  AirdropContract,
  ExchangeContract
};
