'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Response = function Response(errorCode, errorMsg) {
    _classCallCheck(this, Response);

    this.id = '1';
    this.result = null;
    this.error = {
        code: errorCode,
        message: errorMsg,
        data: null
    };
};

exports.default = Response;