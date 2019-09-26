// Borrowed from https://medium.com/coinmonks/testing-time-dependent-logic-in-ethereum-smart-contracts-1b24845c7f72

export default async (seconds: number) => {
  web3.currentProvider.send(
    {
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [seconds],
      id: new Date().getSeconds()
    },
    (err: string, resp: any) => {
      if (!err) {
        web3.currentProvider.send({
          jsonrpc: "2.0",
          method: "evm_mine",
          params: [],
          id: new Date().getSeconds()
        });
      }
    }
  );
};
