/**
 * @description detail :https://github.com/Loopring/relay/blob/wallet_v2/LOOPRING_RELAY_API_SPEC_V2.md#portfolio
 * socket event and detail listed
 */
import io from 'socket.io-client'



export function connect(url, options, connectCallback) {
  const socket = io(url, options);
  return new Promise((resolve) => {
    socket.on('connect', () => {
      if (connectCallback) {
        connectCallback();
      }
      resolve(socket)
    })
  })
}


export function emit(socket, event, options) {
  socket.emit(event, JSON.stringify(options))
}

export function on(socket, event, handle) {
  socket.on(event, (res) => {
    res = JSON.parse(res);
    handle(res)
  })
}
