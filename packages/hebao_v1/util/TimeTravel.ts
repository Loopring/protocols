let advanceTimeAsync = (time: number) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [time],
        id: new Date().getTime()
      },
      (err: string, result: any) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }
    );
  });
};

let advanceBlockAsync = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_mine",
        id: new Date().getTime()
      },
      (err: string) => {
        if (err) {
          return reject(err);
        }
        const newBlockHash = web3.eth.getBlock("latest").hash;
        return resolve(newBlockHash);
      }
    );
  });
};

let advanceTimeAndBlockAsync = async (time: number) => {
  await advanceTimeAsync(time);
  await advanceBlockAsync();

  return Promise.resolve(web3.eth.getBlock("latest"));
};

export { advanceTimeAsync, advanceBlockAsync, advanceTimeAndBlockAsync };
