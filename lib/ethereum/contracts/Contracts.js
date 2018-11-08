'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _Contract = require('./Contract');

var _Contract2 = _interopRequireDefault(_Contract);

var _ring = require('../../relay/rpc/ring');

var _formatter = require('../../common/formatter');

var _ethereumjsUtil = require('ethereumjs-util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var erc20Abi = require('../../config/abis/erc20.json');
var wethAbi = require('../../config/abis/weth.json');
var airdropAbi = require('../../config/abis/airdrop.json');
var loopringProtocolAbi = require('../../config/abis/loopringProtocol.json');

var ERC20Token = new _Contract2.default(erc20Abi);
var WETH = new _Contract2.default(wethAbi);
var AirdropContract = new _Contract2.default(airdropAbi);
var LoopringProtocol = new _Contract2.default(loopringProtocolAbi);

var encodeCancelOrder = function encodeCancelOrder(signedOrder, amount) {
    var owner = signedOrder.owner,
        tokenS = signedOrder.tokenS,
        tokenB = signedOrder.tokenB,
        walletAddress = signedOrder.walletAddress,
        authAddr = signedOrder.authAddr,
        amountS = signedOrder.amountS,
        amountB = signedOrder.amountB,
        validSince = signedOrder.validSince,
        validUntil = signedOrder.validUntil,
        lrcFee = signedOrder.lrcFee,
        buyNoMoreThanAmountB = signedOrder.buyNoMoreThanAmountB,
        marginSplitPercentage = signedOrder.marginSplitPercentage,
        v = signedOrder.v,
        r = signedOrder.r,
        s = signedOrder.s;

    var addresses = [owner, tokenS, tokenB, walletAddress, authAddr];
    amount = amount || (buyNoMoreThanAmountB ? amountB : amountS);
    var orderValues = [amountS, amountB, validSince, validUntil, lrcFee, amount];
    return LoopringProtocol.encodeInputs('cancelOrder', { addresses: addresses, orderValues: orderValues, buyNoMoreThanAmountB: buyNoMoreThanAmountB, marginSplitPercentage: marginSplitPercentage, v: v, r: r, s: s });
};

var encodeSubmitRing = function encodeSubmitRing(orders, feeRecipient, feeSelections) {
    if (!feeSelections) {
        feeSelections = orders.map(function (item) {
            return 0;
        });
    }
    var ringHash = (0, _ring.getRingHash)(orders, feeRecipient, feeSelections);
    var amounts = orders.map(function (order) {
        return (0, _formatter.toNumber)((0, _formatter.toBig)(order.amountS).div((0, _formatter.toBig)(order.amountB)));
    });
    var tem = amounts.reduce(function (total, amount) {
        return total * amount;
    });
    var rate = Math.pow(tem, 1 / orders.length);
    var addressList = orders.map(function (order) {
        return [order.owner, order.tokenS, order.walletAddress, order.authAddr];
    });
    var uintArgsList = orders.map(function (order) {
        return [order.amountS, order.amountB, order.validSince, order.validUntil, order.lrcFee, (0, _formatter.toHex)((0, _formatter.toBig)((0, _formatter.toFixed)((0, _formatter.toBig)(order.amountS).times((0, _formatter.toBig)(rate)))))];
    });
    var uint8ArgsList = orders.map(function (order) {
        return [order.marginSplitPercentage];
    });
    var buyNoMoreThanAmountBList = orders.map(function (order) {
        return order.buyNoMoreThanAmountB;
    });
    var sigs = orders.map(function (order) {
        var sig = (0, _ethereumjsUtil.ecsign)((0, _ethereumjsUtil.hashPersonalMessage)(ringHash), (0, _formatter.toBuffer)((0, _formatter.addHexPrefix)(order.authPrivateKey)));
        return {
            v: (0, _formatter.toNumber)(sig.v),
            r: (0, _formatter.toHex)(sig.r),
            s: (0, _formatter.toHex)(sig.s)
        };
    });
    var vList = orders.map(function (order) {
        return order.v;
    });
    vList.push.apply(vList, _toConsumableArray(sigs.map(function (sig) {
        return sig.v;
    })));
    var rList = orders.map(function (order) {
        return order.r;
    });
    rList.push.apply(rList, _toConsumableArray(sigs.map(function (sig) {
        return sig.r;
    })));
    var sList = orders.map(function (order) {
        return order.s;
    });
    sList.push.apply(sList, _toConsumableArray(sigs.map(function (sig) {
        return sig.s;
    })));

    return LoopringProtocol.encodeInputs('submitRing', {
        addressList: addressList,
        uintArgsList: uintArgsList,
        uint8ArgsList: uint8ArgsList,
        buyNoMoreThanAmountBList: buyNoMoreThanAmountBList,
        vList: vList,
        rList: rList,
        sList: sList,
        miner: feeRecipient,
        feeSelections: (0, _ring.feeSelectionListToNumber)(feeSelections)
    });
};

Object.assign(LoopringProtocol, { encodeCancelOrder: encodeCancelOrder, encodeSubmitRing: encodeSubmitRing });

exports.default = {
    ERC20Token: ERC20Token,
    WETH: WETH,
    AirdropContract: AirdropContract,
    LoopringProtocol: LoopringProtocol
};