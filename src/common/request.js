import fetch from 'whatwg-fetch';
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
 * @returns {Promise}
 */
function request(host, options) {
  try{
    if (options.body) {
      options.headers = options.headers || headers;
      options.body = JSON.stringify(options.body);
    }
    return fetch(host, options).then(checkStatus).then(res => res.json()).catch((e)=>{
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
