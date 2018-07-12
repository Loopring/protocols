import Contract from './Contract';
import {getRingHash, feeSelectionListToNumber} from '../../relay/rpc/ring';
import {addHexPrefix, toBig, toBuffer, toFixed, toHex, toNumber} from '../../common/formatter';
import {ecsign, hashPersonalMessage} from 'ethereumjs-util';

const erc20Abi = require('../../config/abis/erc20.json');
const wethAbi = require('../../config/abis/weth.json');
const airdropAbi = require('../../config/abis/airdrop.json');
const loopringProtocolAbi = require('../../config/abis/loopringProtocol.json');

const ERC20Token = new Contract(erc20Abi);
const WETH = new Contract(wethAbi);
const AirdropContract = new Contract(airdropAbi);
const LoopringProtocol = new Contract(loopringProtocolAbi);

const encodeCancelOrder = (signedOrder, amount) =>
{
    const {
        owner, tokenS, tokenB, walletAddress, authAddr,
        amountS, amountB, validSince, validUntil, lrcFee,
        buyNoMoreThanAmountB,
        marginSplitPercentage,
        v,
        r,
        s
    } = signedOrder;
    const addresses = [owner, tokenS, tokenB, walletAddress, authAddr];
    amount = amount || (buyNoMoreThanAmountB ? amountB : amountS);
    const orderValues = [amountS, amountB, validSince, validUntil, lrcFee, amount];
    return LoopringProtocol.encodeInputs('cancelOrder', {addresses, orderValues, buyNoMoreThanAmountB, marginSplitPercentage, v, r, s});
};

const encodeSubmitRing = (orders, feeRecipient, feeSelections) =>
{
    if (!feeSelections)
    {
        feeSelections = orders.map(item => 0);
    }
    const ringHash = getRingHash(orders, feeRecipient, feeSelections);
    const amounts = orders.map(order => toNumber(toBig(order.amountS).div(toBig(order.amountB))));
    const tem = amounts.reduce((total, amount) =>
    {
        return total * amount;
    });
    const rate = Math.pow(tem, orders.length);
    const addressList = orders.map(order => [order.owner, order.tokenS, order.walletAddress, order.authAddr]);
    const uintArgsList = orders.map(order => [order.amountS, order.amountB, order.validSince, order.validUntil, order.lrcFee, toHex(toBig(toFixed(toBig(order.amountS).times(toBig(rate)))))]);
    const uint8ArgsList = orders.map(order => [order.marginSplitPercentage]);
    const buyNoMoreThanAmountBList = orders.map(order => order.buyNoMoreThanAmountB);
    const sigs = orders.map(order =>
    {
        const sig = ecsign(hashPersonalMessage(ringHash), toBuffer(addHexPrefix(order.authPrivateKey)));
        return {
            v: toNumber(sig.v),
            r: toHex(sig.r),
            s: toHex(sig.s)
        };
    });
    const vList = orders.map(order => order.v);
    vList.push(...sigs.map(sig => sig.v));
    const rList = orders.map(order => order.r);
    rList.push(...sigs.map(sig => sig.r));
    const sList = orders.map(order => order.s);
    sList.push(...sigs.map(sig => sig.s));

    return LoopringProtocol.encodeInputs('submitRing', {
        addressList,
        uintArgsList,
        uint8ArgsList,
        buyNoMoreThanAmountBList,
        vList,
        rList,
        sList,
        miner: feeRecipient,
        feeSelections: feeSelectionListToNumber(feeSelections)
    });
};

Object.assign(LoopringProtocol, {encodeCancelOrder, encodeSubmitRing});

export default {
    ERC20Token,
    WETH,
    AirdropContract,
    LoopringProtocol
};
