import basicSchemas from '../common/schemas';

const ethereumSchemas = {
    ...basicSchemas,
    PRIVATE_KEY_BUFFER: {
        validator: (rule, value, cb) =>
        {
            if (value instanceof Buffer)
            {
                value.length === 32 ? cb() : cb('length of private key must be 32');
            }
            else
            {
                cb('private key is not an instance of Buffer');
            }
        }
    },
    TX_HASH: {
        type: 'string',
        required: true,
        pattern: /^0x[0-9a-fA-F]{64}$/g
    },
    BASIC_TX: {
        type: 'object',
        required: true,
        fields: {
            to: {
                ...basicSchemas.ETH_ADDRESS
            },
            value: {
                ...basicSchemas.ETH_VALUES
            },
            gasLimit: {
                type: 'string',
                pattern: /^0x[0-9a-fA-F]{1,64}$/g
            },
            gasPrice: {
                type: 'string',
                pattern: /^0x[0-9a-fA-F]{1,64}$/g
            },
            chainId: {
                type: 'number'
            },
            nonce: {
                type: 'string',
                required: true,
                pattern: /^0x[0-9a-fA-F]{1,64}$/g
            },
            data: {
                type: 'string',
                required: true,
                pattern: /^0x[0-9a-fA-F]*$/g
            }
        }
    },
    TX: {
        type: 'object',
        required: true,
        fields: {
            to: {
                ...basicSchemas.ETH_ADDRESS
            },
            value: {
                ...basicSchemas.ETH_VALUES
            },
            gasLimit: {
                ...basicSchemas.ETH_VALUES
            },
            gasPrice: {
                ...basicSchemas.ETH_VALUES
            },
            chainId: {
                type: 'number',
                required: true
            },
            nonce: {
                ...basicSchemas.ETH_VALUES
            },
            data: {
                type: 'string',
                required: true,
                pattern: /^0x[0-9a-fA-F]*$/g
            },
            signed: {
                type: 'string'
            }
        }
    }
};

export default ethereumSchemas;
