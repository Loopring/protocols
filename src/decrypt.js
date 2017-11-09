const crypto = require('crypto');

exports.decryptPrivKey = function (encprivkey,password) {
    var cipher = encprivkey.slice(0, 128);
    cipher = crypto.decodeCryptojsSalt(cipher);
    const evp = evp_kdf(new Buffer(password), cipher.salt, {
        keysize: 32,
        ivsize: 16
    });
    const decipher = crypto.createDecipheriv('aes-256-cbc', evp.key, evp.iv);
    const privKey = decipherBuffer(decipher, new Buffer(cipher.ciphertext));

    return new Buffer(privKey.toString(), 'hex');
};

exports.decodeCryptojsSalt = function (input) {
    var ciphertext = new Buffer(input, 'base64');
    if (ciphertext.slice(0, 8).toString() === 'Salted__') {
        return {
            salt: ciphertext.slice(8, 16),
            ciphertext: ciphertext.slice(16)
        };
    } else {
        return {
            ciphertext: ciphertext
        };
    }
}



 exports.decipherBuffer = function(decipher,data) {
    return Buffer.concat([decipher.update(data), decipher.final()]);
}

 exports.evp_kdf = function(data,salt,opts) {

    function iter(block) {
        let hash = crypto.createHash(opts.digest || 'md5');
        hash.update(block);
        hash.update(data);
        hash.update(salt);
        block = hash.digest();
        for (let i = 1; i < (opts.count || 1); i++) {
            hash = crypto.createHash(opts.digest || 'md5');
            hash.update(block);
            block = hash.digest();
        }
        return block;
    }
    let keysize = opts.keysize || 16;
    let ivsize = opts.ivsize || 16;
    let ret = [];
    let i = 0;
    while (Buffer.concat(ret).length < keysize + ivsize) {
        ret[i] = iter(i === 0 ? new Buffer(0) : ret[i - 1]);
        i++;
    }
    let tmp = Buffer.concat(ret);
    return {
        key: tmp.slice(0, keysize),
        iv: tmp.slice(keysize, keysize + ivsize)
    };

}