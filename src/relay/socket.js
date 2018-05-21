/**
 * @description detail :https://github.com/Loopring/relay/blob/wallet_v2/LOOPRING_RELAY_API_SPEC_V2.md#portfolio
 * socket event and detail listed
 */
import io from 'socket.io-client'

export class Socket{

  constructor(url,options){
    options = options || { transports: ['websocket']};
    const socket = io(url, options);
    const _this = this;
    socket.on('connect', () => {
      _this.socket = socket;
    })
  }
    emit(event, options) {
    this.socket.emit(event, JSON.stringify(options))
  }

   on( event, handle) {
    this.socket.on(event, (res) => {
      res = JSON.parse(res);
      handle(res)
    })
  }

}









