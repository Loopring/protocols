import Contract from './Contract';

const erc20Abi = require('../../config/abis/erc20.json');
const wethAbi = require('../../config/abis/weth.json');
const airdropAbi = require('../../config/abis/airdrop.json');
const exchangeAbi = require('../../config/abis/exchange.json');

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
