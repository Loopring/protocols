import fetch from 'dva/fetch';
import crypto from 'crypto';

const headers = {
  'Content-Type': 'application/json'
};

/**
 * @description Supports single request and batch request;
 * @param host
 * @param options
 * @returns {Promise}
 */
function request(host, options) {
  try{
    if (options.body) {
      options.headers = options.headers || headers;
      options.body = JSON.stringify(options.body);
    }
    return fetch(host, options).then(res => res.json()).catch((e)=>{
      return {error:e}
    })
  }catch(e){
    return new Promise((resolve)=>{
      resolve({"error":e})
    })
  }
}

/**
 * @description Returns a random hex string
 */
export function id() {
  return crypto.randomBytes(8).toString('hex');
}

export default request;
