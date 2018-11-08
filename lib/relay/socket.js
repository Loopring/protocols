'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @description detail :https://github.com/Loopring/relay/blob/wallet_v2/LOOPRING_RELAY_API_SPEC_V2.md#portfolio
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * socket event and detail listed
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */


var _socket = require('socket.io-client');

var _socket2 = _interopRequireDefault(_socket);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Socket = function () {
    function Socket(url, options) {
        _classCallCheck(this, Socket);

        options = options || { transports: ['websocket'] };
        this.socket = (0, _socket2.default)(url, options);
    }

    _createClass(Socket, [{
        key: 'emit',
        value: function emit(event, options) {
            this.socket.emit(event, JSON.stringify(options));
        }
    }, {
        key: 'on',
        value: function on(event, handle) {
            this.socket.on(event, function (res) {
                res = JSON.parse(res);
                handle(res);
            });
        }
    }, {
        key: 'close',
        value: function close() {
            this.socket.close();
        }
    }]);

    return Socket;
}();

exports.default = Socket;