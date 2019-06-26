import Schema from 'async-validator';
import basicSchemas from '../common/schemas';
import transactionSchmas from './schemas';

const schemas = {
    basic: {
        ...basicSchemas
    },
    transaction: {
        ...transactionSchmas
    }
};

let handleErrors = (errors, fields) => {
    let msgs = errors.map(err => err.message).join();
    throw new Error(`data type invalid: ${msgs} \n`)
};

let validate = (payload) => {
    let {type, value, onError, onSuccess} = payload;
    let source = {};
    let schema = {};

    // fix bug: if value undefined or null
    if (typeof value === 'undefined') {
        throw new Error(`data type invalid: ${type} should not be undefined`)
    }
    if (value === null) {
        throw new Error(`data type invalid: ${type} should not be null`)
    }

    if (schemas['basic'][type]) {
        // validate one field , schema & source must just has one field
        schema[type] = schemas['basic'][type];
        source[type] = value
    }
    if (schemas['transaction'][type]) {
        // validate multiple fileds , schema & source must has multiple fields
        schema[type] = {
            type: 'object',
            required: true,
            fields: schemas['transaction'][type]
        };
        source[type] = value
    }

    // TODO: if schema empty
    let validator = new Schema(schema);
    validator.validate(source, (errors, fields) => {
        if (errors) {
            console.log('validate start source', source);
            console.log('validate start schema', schema);
            if (onError) {
                onError(errors, fields)
            } else {
                handleErrors(errors, fields);
            }
        } else {
            if (onSuccess) {
                onSuccess()
            }
        }
    })
};

export default {
    validate
}
