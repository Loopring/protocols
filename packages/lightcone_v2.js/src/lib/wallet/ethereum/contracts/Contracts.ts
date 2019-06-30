import Contract from './Contract';

const erc20Abi = require('../../config/abis/erc20.json.js');
const wethAbi = require('../../config/abis/weth.json.js');
const airdropAbi = require('../../config/abis/airdrop.json.js');
const exchangeAbi = require('../../config/abis/exchange.json.js');

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
