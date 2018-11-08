'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

let _createClass = (function () { function defineProperties (target, props) { for (let i = 0; i < props.length; i++) { let descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }());

let _formatter = require('./formatter');

let _ethereumjsUtil = require('ethereumjs-util');

function _classCallCheck (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

let BitStream = (function ()
{
    function BitStream ()
    {
        let initialData = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

        _classCallCheck(this, BitStream);

        this.data = (0, _formatter.addHexPrefix)(initialData);
    }

    _createClass(BitStream, [{
        key: 'getData',
        value: function getData ()
        {
            return this.data;
        }
    }, {
        key: 'addNumber',
        value: function addNumber (data)
        {
            let length = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 4;
            let forceAppend = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

            this.insert((0, _formatter.clearHexPrefix)((0, _formatter.toHex)((0, _ethereumjsUtil.setLength)((0, _formatter.toBuffer)(data), length))), forceAppend);
        }
    }, {
        key: 'addAddress',
        value: function addAddress (address)
        {
            let forceAppend = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

            this.insert((0, _formatter.clearHexPrefix)(address), forceAppend);
        }
    }, {
        key: 'addBigNumber',
        value: function addBigNumber (data)
        {
            let length = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 32;
            let forceAppend = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

            this.insert((0, _formatter.clearHexPrefix)((0, _formatter.toHex)((0, _ethereumjsUtil.setLength)((0, _formatter.toBuffer)((0, _formatter.toHex)(data)), length))), forceAppend);
        }
    }, {
        key: 'addHex',
        value: function addHex (data)
        {
            let forceAppend = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

            return this.insert((0, _formatter.clearHexPrefix)(data), forceAppend);
        }
    }, {
        key: 'addRawBytes',
        value: function addRawBytes (bs)
        {
            let forceAppend = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

            this.insert((0, _formatter.clearHexPrefix)((0, _formatter.toHex)(bs)), forceAppend);
        }
    }, {
        key: 'insert',
        value: function insert (x, forceAppend)
        {
            let offset = this.length();
            if (!forceAppend)
            {
                // Check if the data we're inserting is already available in the bitstream.
                // If so, return the offset to the location.
                let start = 0;
                while (start !== -1)
                {
                    start = this.data.indexOf(x, start);
                    if (start !== -1)
                    {
                        if (start % 2 === 0)
                        {
                            // logDebug("++ Reused " + x + " at location " + start / 2);
                            return start / 2;
                        }
                        else
                        {
                            start++;
                        }
                    }
                }
            }
            this.data += x;
            return offset;
        }

        // Returns the number of bytes of data

    }, {
        key: 'length',
        value: function length ()
        {
            return this.data.length / 2;
        }
    }]);

    return BitStream;
}());

exports.default = BitStream;
