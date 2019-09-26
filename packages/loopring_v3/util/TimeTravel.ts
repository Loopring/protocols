// Borrowed from https://medium.com/coinmonks/testing-time-dependent-logic-in-ethereum-smart-contracts-1b24845c7f72

const jsonrpc = "2.0";
const id = 0;
const send = (method: string, params: any = []) => {
  web3.currentProvider.send({ id, jsonrpc, method, params });
};
const timeTravel = async (seconds: number) => {
  await send("evm_increaseTime", [seconds]);
  await send("evm_mine");
};
export default timeTravel;
