import basicSchemas from '../common/schemas';

const loopringScheams = {
    ...basicSchemas,
    INTERVAL: {
        type: 'enum',
        required: true,
        enum: ['1Hr', '2Hr', '4Hr', '1Day', '1Week']
    },
    HASH: {
        type: 'string',
        required: true,
        pattern: /^0x[0-9a-fA-F]{64}$/g
    },
    PROJECT_ID: {
        type: 'number',
        required: true,
        min: 1
    },
    LOOPRING_TOKEN: {
        type: 'enum',
        required: true,
        enum: ['LRC', 'LRN', 'LRQ']
    },
    CANCEL_ORDER_TYPE: {
        type: 'enum',
        required: true,
        enum: [1, 2, 3, 4]
    },
    RAW_Order: {
        type: 'object',
        required: true,
        fields: {
            delegateAddress: {
                ...basicSchemas.ETH_ADDRESS
            },
            protocol: {
                ...basicSchemas.ETH_ADDRESS
            },
            owner: {
                ...basicSchemas.ETH_ADDRESS
            },
            tokenS: {
                ...basicSchemas.ETH_ADDRESS
            },
            tokenB: {
                ...basicSchemas.ETH_ADDRESS
            },
            authAddr: {
                ...basicSchemas.ETH_ADDRESS
            },
            authPrivateKey: {
                ...basicSchemas.ETH_KEY,
                required: false
            },
            validSince: {
                ...basicSchemas.ETH_VALUES
            },
            validUntil: {
                ...basicSchemas.ETH_VALUES
            },
            amountS: {
                ...basicSchemas.ETH_VALUES
            },
            amountB: {
                ...basicSchemas.ETH_VALUES
            },
            lrcFee: {
                ...basicSchemas.ETH_VALUES
            },
            walletAddress: {
                ...basicSchemas.ETH_ADDRESS
            },
            buyNoMoreThanAmountB: {
                type: 'boolean',
                required: true
            },
            marginSplitPercentage: {
                type: 'integer',
                required: true,
                minimum: 0,
                maximum: 100
            }
        }
    },
    ORDER: {
        type: 'object',
        required: true,
        fields: {
            delegateAddress: {
                ...basicSchemas.ETH_ADDRESS
            },
            protocol: {
                ...basicSchemas.ETH_ADDRESS
            },
            owner: {
                ...basicSchemas.ETH_ADDRESS
            },
            tokenS: {
                ...basicSchemas.ETH_ADDRESS
            },
            tokenB: {
                ...basicSchemas.ETH_ADDRESS
            },
            authAddr: {
                ...basicSchemas.ETH_ADDRESS
            },
            authPrivateKey: {
                ...basicSchemas.ETH_KEY,
                required: false
            },
            validSince: {
                ...basicSchemas.ETH_VALUES
            },
            validUntil: {
                ...basicSchemas.ETH_VALUES
            },
            amountS: {
                ...basicSchemas.ETH_VALUES
            },
            amountB: {
                ...basicSchemas.ETH_VALUES
            },
            lrcFee: {
                ...basicSchemas.ETH_VALUES
            },
            walletAddress: {
                ...basicSchemas.ETH_ADDRESS
            },
            buyNoMoreThanAmountB: {
                type: 'boolean',
                required: true
            },
            marginSplitPercentage: {
                type: 'integer',
                required: true,
                minimum: 0,
                maximum: 100
            },
            v: {
                type: 'integer',
                required: true,
                minimum: 0
            },
            s: {
                'type': 'string',
                required: true,
                pattern: /^0x[0-9a-fA-F]{64}$/g
            },
            r: {
                'type': 'string',
                required: true,
                pattern: /^0x[0-9a-fA-F]{64}$/g
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
            }
        }
    }
};

export default loopringScheams;
