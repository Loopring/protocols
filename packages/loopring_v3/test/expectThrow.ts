export async function expectThrow(
  promise: Promise<any>,
  expectedRevertMessage?: string
) {
  try {
    await promise;
  } catch (error) {
    if (expectedRevertMessage) {
      const message = error.message.search(expectedRevertMessage) >= 0;
      assert(
        message,
        "Expected throw with message " +
          expectedRevertMessage +
          ", got '" +
          error +
          "' instead"
      );
    } else {
      const revert = error.message.search("revert") >= 0;
      const invalidOpcode = error.message.search("invalid opcode") >= 0;
      assert(
        revert || invalidOpcode,
        "Expected throw, got '" + error + "' instead"
      );
    }
    return;
  }
  assert.fail(
    "Expected throw not received" +
      (expectedRevertMessage ? " (" + expectedRevertMessage + ")" : "")
  );
}
