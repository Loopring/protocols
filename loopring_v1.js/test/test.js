const Contracts = require('../lib/ethereum/contracts/Contracts').default;
const fm = require('../lib/common/formatter');
const Order = require('../lib/relay/rpc/order');
const Ring = require('../lib/relay/rpc/ring');
const ethUtil = require('ethereumjs-util');

const order1 = {
    'amountS': fm.toHex(fm.toBig('3700000000000000')),
    'amountB': fm.toHex(fm.toBig('10000000000000000000'))
};

const order2 = {
    'amountB': fm.toHex(fm.toBig('3700000000000000')),
    'amountS': fm.toHex(fm.toBig('10000000000000000000'))
};

const orders = [order1, order2];

const amounts = orders.map(order => fm.toBig(order.amountS).div(fm.toBig(order.amountB)));
const tem = amounts.reduce((total, amount) =>
{
    return total.times(amount);
});
const rate = tem.pow(fm.toBig(1 / orders.length));

orders.forEach(order => console.log(fm.toNumber(fm.toHex(fm.toBig(fm.toFixed(fm.toBig(order.amountS).times(rate)))))));
