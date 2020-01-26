export async function getEventsFromContract(contract: any, blockIdx: number) {
  return contract.getPastEvents("allEvents", {
    fromBlock: blockIdx,
    toBlock: blockIdx
  });
}

// This works differently from truffleAssert.eventEmitted in that it also is able to
// get events emmitted in `deep contracts` (i.e. events not emmitted in the contract
// the function got called in).
export async function assertEventsEmitted(
  contract: any,
  eventName: string,
  numExpected: number,
  filter?: any
) {
  const allEvents: any = await getEventsFromContract(
    contract,
    web3.eth.blockNumber
  );
  const events = allEvents.filter((event: any) => event.event === eventName);
  const items = events.map((eventObj: any) => {
    const args = eventObj.args ? eventObj.args : eventObj.returnValues;
    if (filter !== undefined) {
      assert(
        filter(args),
        "Event " +
          eventName +
          " values unexpected: \n" +
          JSON.stringify(args, null, 4)
      );
    }
    return args;
  });
  assert.equal(
    items.length,
    numExpected,
    "Unexpected number of " + eventName + " events: "
  );
  return items;
}

export async function assertEventEmitted(
  contract: any,
  event: string,
  filter?: any
) {
  return (await this.assertEventsEmitted(contract, event, 1, filter))[0];
}

export async function assertNoEventEmitted(contract: any, event: string) {
  await this.assertEventsEmitted(contract, event, 0, undefined);
}
