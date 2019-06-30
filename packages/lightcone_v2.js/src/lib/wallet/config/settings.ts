import {configs} from '../../common/config/data'

const set = (settings) => {
    localStorage.settings = JSON.stringify(settings)
};
const latestContract = configs.contracts[configs.contracts.length - 1];
const relays = configs.relays;
let sortedRelays = relays.map((item, i) => {
    item.id = i;
    return item
});
const get = () => {
    if (localStorage.settings) {
        return JSON.parse(localStorage.settings)
    } else {
        return {
            preference: {
                language: window.USER_AGENT.getLanguage() || 'en-US',
                currency: window.USER_AGENT.getLanguage() === 'zh-CN' ? 'CNY' : "USD",
                timezone: "UTC+00:00"
            },
            trading: {
                contract: {
                    version: latestContract.version,
                    address: latestContract.address
                },
                timeToLive: configs.defaultExpireTime,
                timeToLiveUnit: configs.defaultExpireTimeUnit,
                lrcFee: configs.defaultLrcFeePermillage,
                marginSplit: configs.defaultMarginSplitPercentage,
                gasPrice: configs.defaultGasPrice
            },
            relay: {
                selected: sortedRelays[0].value,
                nodes: sortedRelays
            }
        }
    }
};
const getRelay = () => {
    const defaultHost = sortedRelays[0].value;
    if (localStorage.settings) {
        const settings = JSON.parse(localStorage.settings);
        return settings.relay.selected || defaultHost
    } else {
        return defaultHost
    }
};
const getContractVersion = () => {
    const defaultVersion = latestContract.version;
    if (localStorage.settings) {
        const settings = JSON.parse(localStorage.settings);
        return settings.trading.contract.version || defaultVersion
    } else {
        return defaultVersion
    }
};

const setTokensConfig = (tokens) => {
    localStorage.tokensConfig = JSON.stringify(tokens)
};

const getTokensConfig = () => {
    if (localStorage.tokensConfig) {
        return JSON.parse(localStorage.tokensConfig)
    } else {
        return []
    }
};

const setMarketPairs = (markets) => {
    localStorage.marketsConfig = JSON.stringify(markets)
};

const getMarketPairs = () => {
    if (localStorage.marketsConfig) {
        return JSON.parse(localStorage.marketsConfig)
    } else {
        return []
    }
};

const setMarketR = (markets) => {
    localStorage.marketR = JSON.stringify(markets)
};

const getMarketR = () => {
    if (localStorage.marketR) {
        return JSON.parse(localStorage.marketR)
    } else {
        return []
    }
};

const setConfigs = (configs) => {
    localStorage.configs = JSON.stringify(configs)
};

const getConfigs = () => {
    if (localStorage.configs) {
        return JSON.parse(localStorage.configs)
    } else {
        return []
    }
};

export default {
    set,
    get,
    getRelay,
    getContractVersion,
    setTokensConfig,
    getTokensConfig,
    setMarketPairs,
    getMarketPairs,
    setMarketR,
    getMarketR,
    setConfigs,
    getConfigs
}

