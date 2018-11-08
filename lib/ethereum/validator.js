'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _asyncValidator = require('async-validator');

var _asyncValidator2 = _interopRequireDefault(_asyncValidator);

var _schemas = require('./schemas');

var _schemas2 = _interopRequireDefault(_schemas);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var handleErrors = function handleErrors(errors, fields) {
    var msgs = errors.map(function (err) {
        return err.message;
    }).join();
    throw new Error('data type invalid: ' + msgs + ' \n');
};

var validate = function validate(payload) {
    var type = payload.type,
        value = payload.value,
        onError = payload.onError,
        onSuccess = payload.onSuccess;

    var source = {};
    var schema = {};

    if (typeof value === 'undefined') {
        throw new Error('data type invalid: ' + type + ' should not be undefined');
    }
    if (value === null) {
        throw new Error('data type invalid: ' + type + ' should not be null');
    }
    if (_schemas2.default[type]) {
        schema[type] = _schemas2.default[type];
        source[type] = value;
    } else {
        throw new Error('invalid type');
    }
    var validator = new _asyncValidator2.default(schema);
    validator.validate(source, function (errors, fields) {
        if (errors) {
            if (onError) {
                onError(errors, fields);
            } else {
                handleErrors(errors, fields);
            }
        } else {
            if (onSuccess) {
                onSuccess();
            }
        }
    });
};

exports.default = {
    validate: validate
};