import * as _ from 'lodash';

export enum NetworkId {
    Mainnet     = 1,
    Ropsten     = 3,
    Rinkeby     = 4,
    Kovan       = 42,
}

export interface LoopringAddresses {
    tradeDelegate: string;
}

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const networkToAddresses: { [networkId: number]: LoopringAddresses } = {
    1: {
        tradeDelegate: '0x2240dab907db71e64d3e0dba4800c83b5c502d4e',
    },
    3: {
        tradeDelegate: '0xb1408f4c245a23c31b98d2c626777d4c0d766caa',
    },
    4: {
        tradeDelegate: '0xbce0b5f6eb618c565c3e5f5cd69652bbc279f44e',
    },
    42: {
        tradeDelegate: '0xf1ec01d6236d3cd881a0bf0130ea25fe4234003e',
    },
};

/**
 * Used to get addresses of contracts that have been deployed to either the
 * Ethereum mainnet or a supported testnet. Throws if there are no known
 * contracts deployed on the corresponding network.
 * @param networkId The desired networkId.
 * @returns The set of addresses for contracts which have been deployed on the
 * given networkId.
 */
export function getContractAddressesForNetworkOrThrow(
    networkId: NetworkId): LoopringAddresses {
    if (_.isUndefined(networkToAddresses[networkId])) {
        throw new Error(`Invalid network id (${networkId}).`);
    }
    return networkToAddresses[networkId];
}