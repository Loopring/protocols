import "isomorphic-fetch";
import crypto from "crypto";

const headers = {
  "Content-Type": "application/json"
};

function checkStatus(response) {
  if (response.status >= 200 && response.status < 300) {
    return response;
  } else {
    const error = new Error(response.statusText);
    error["response"] = response;
    throw error;
  }
}

/**
 * @description Supports single request and batch request;
 * @param host
 * @param options
 * @param timeOut
 * @returns {Promise}
 */
function request(host: string, options: any, timeOut?: number) {
  timeOut = timeOut || 15000;
  const requestPromise = new Promise(resolve => {
    if (options.body) {
      options.headers = options.headers || headers;
      options.body = JSON.stringify(options.body);
    }
    fetch(host, options)
      .then(checkStatus)
      .then(res => res.json())
      .then(data => resolve(data))
      .catch(e => {
        resolve({ error: e });
      });
  });
  const timeoutPromise = new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve({ error: { message: "request time out" } });
    }, timeOut);
  });
  return Promise.race([requestPromise, timeoutPromise]);
}

/**
 * @description Returns a random hex string
 */
export function id() {
  return crypto.randomBytes(8).toString("hex");
}

export default request;
