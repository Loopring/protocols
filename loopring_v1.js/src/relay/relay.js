import Account from './rpc/account';
import Order from './rpc/order';
import Market from './rpc/market';
import Ring from './rpc/ring';

export default class Relay
{
    constructor (host)
    {
        this.account = new Account(host);
        this.order = new Order(host);
        this.market = new Market(host);
        this.ring = new Ring(host);
    }
}
