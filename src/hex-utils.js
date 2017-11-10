const BigNumber = require('bignumber.js')

exports.stripHex= function (address) {
    return address.replace('0x', '').toLowerCase();

};

exports.valueToHex = function(value){
    var big = new BigNumber(value);
    return '0x' + big.toString(16);
};
