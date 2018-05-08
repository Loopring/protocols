import Contract from './Contract';

const erc20Abi = require('../../config/abis/erc20.json');
const wethAbi = require('../../config/abis/weth.json');
const airdropAbi = require('../../config/abis/airdrop.json');
const loopringProtocolAbi = require('../../config/abis/loopringProtocol.json')

const ERC20Token = new Contract(erc20Abi);
const WETH = new Contract(wethAbi);
const AirdropContract = new Contract(airdropAbi);
const LoopringProtocol = new Contract(loopringProtocolAbi);

const encodeCancelOrder = (signedOrder, amount) => {
  const {
    owner, tokenS, tokenB, walletAddress,authAddr,
    amountS, amountB, validSince, validUntil, lrcFee,
    buyNoMoreThanAmountB,
    marginSplitPercentage,
    v,
    r,
    s
  } = signedOrder;
  const addresses = [owner, tokenS, tokenB, walletAddress,authAddr];
  amount = amount || (buyNoMoreThanAmountB ? amountB : amountS);
  const orderValues = [amountS, amountB, validSince, validUntil, lrcFee, amount];
  return LoopringProtocol.encodeInputs('cancelOrder',{addresses, orderValues, buyNoMoreThanAmountB, marginSplitPercentage, v, r, s});
};


Object.assign(LoopringProtocol,{encodeCancelOrder});

export default {
  ERC20Token,
  WETH,
  AirdropContract,
  LoopringProtocol
}
