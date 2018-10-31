const Contracts = require('../lib/ethereum/contracts/Contracts').default;
const fm = require('../lib/common/formatter');

const order1 = {
    'delegateAddress': '0x17233e07c67d086464fD408148c3ABB56245FA64',
    'protocol': '0x8d8812b72d1e4ffCeC158D25f56748b7d67c1e78',
    'owner': '0x56447C02767BA621f103C0f3DbF564dbcacF284b',
    'tokenB': '0xef68e7c694f40c8202821edf525de3782458639f',
    'tokenS': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    'amountB': '0x97e81a3e7c517c000',
    'amountS': '0x9184e72a000',
    'lrcFee': '0x0',
    'validSince': '0x5bd34a12',
    'validUntil': '0x5bd49b92',
    'marginSplitPercentage': 0,
    'buyNoMoreThanAmountB': true,
    'walletAddress': '0x56447c02767ba621f103c0f3dbf564dbcacf284b',
    'authAddr': '0x688ed736c2d388264fb08f81b466d2e46ec0bf35',
    'authPrivateKey': '9508518b4b6d6ca20ef967ab5b26ff44865899888c23ec6cb19453a7dee589a6',
    'orderType': 'p2p_order',
    'r': '0x680bf9e74c9986bc31b1c1aece669199b695a79826034236e243e342d4dd35ac',
    's': '0x34a8dc840e5f25bfb3bb6e39aa7ce61ea0fd4bad2c33945cae70693a120982be',
    'v': 28,
    'powNonce': 100
};
const order2 = {
    'protocol': '0x8d8812b72d1e4ffCeC158D25f56748b7d67c1e78',
    'delegateAddress': '0x17233e07c67d086464fD408148c3ABB56245FA64',
    'address': '0xb94065482Ad64d4c2b9252358D746B39e820A582',
    'hash': '0x390809f080bfd439f66f762efa15276fee9d7377c8f8e4001c7ffb443040866d',
    'tokenS': '0xef68e7c694f40c8202821edf525de3782458639f',
    'tokenB': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    'amountS': '0x97e81a3e7c517c000',
    'amountB': '0x9184e72a000',
    'validSince': '0x5bd34823',
    'validUntil': '0x5bfc26a3',
    'lrcFee': '0x0',
    'buyNoMoreThanAmountB': true,
    'marginSplitPercentage': 0,
    'v': '0x1c',
    'r': '0x5db84ed535187149c8801436fc0e89759d2a0e960d0bb37eca79ae2a6722e353',
    's': '0x38cb8578005fea7edd257e7a6a9ea5987ccd63a8c0e558a931828e4eb0624544',
    'walletAddress': '0x56447C02767BA621f103C0f3DbF564dbcacF284b',
    'authAddr': '0xbBE040a613154e8d58DA52B975Cd324A8430e788',
    'authPrivateKey': '45447993b644a00d7d6aaa4351482d29c4c4a0909704169df0262681281ec443',
    'owner': '0xb94065482Ad64d4c2b9252358D746B39e820A582'
};
console.log(Contracts.LoopringProtocol.encodeSubmitRing([order1, order2], '0x5552dcfba48c94544beaaf26470df9898e050ac2'));
