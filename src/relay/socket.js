/**
 * @description detail :https://github.com/Loopring/relay/blob/wallet_v2/LOOPRING_RELAY_API_SPEC_V2.md#portfolio
 * socket event and detail listed
 */
import io from 'socket.io-client';

export default class Socket
{
    constructor (url, options)
    {
        options = options || {transports: ['websocket']};
        this.socket = io(url, options);
    }
    emit (event, options)
    {
        this.socket.emit(event, JSON.stringify(options));
    }

    on (event, handle)
    {
        this.socket.on(event, (res) =>
        {
            res = JSON.parse(res);
            handle(res);
        });
    }

    close ()
    {
        this.socket.close();
    }
}
