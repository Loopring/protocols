import 'whatwg-fetch';
import crypto from 'crypto';

const headers = {
  'Content-Type': 'application/json'
};


function checkStatus(response) {
    if (response.status >= 200 && response.status < 300) {
        return response
    } else {
        const error = new Error(response.statusText);
        error.response = response;
        throw error
    }
}
/**
 * @description Supports single request and batch request;
 * @param host
 * @param options
 * @param timeOut
 * @returns {Promise}
 */
function request(host, options, timeOut) {

    timeOut = timeOut || 150000
   const request_promise = new Promise((resolve) => {
     if (options.body) {
       options.headers = options.headers || headers;
       options.body = JSON.stringify(options.body);
     }
     fetch(host, options)
     .then(checkStatus)
     .then(res => res.json())
     .then(data => resolve(data))
     .catch((e)=>{
       resolve({error:e})
     })
   });
   const timeout_promise =  new Promise((resolve, reject) => {
     setTimeout(() => {
       reject({error:{message:'request time out'}});
     },timeOut)
  });
   return Promise.race([request_promise,timeout_promise])
}
/**
 * @description Returns a random hex string
 */
export function id() {
  return crypto.randomBytes(8).toString('hex');
}

export default request;
