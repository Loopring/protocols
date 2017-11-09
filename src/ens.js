const uts46 = require('idna-uts46');
exports.normalise = function(name){
    try {
        return uts46.toUnicode(name, {useStd3ASCII: true, transitional: false});
    } catch (e) {
        throw e;
    }
}