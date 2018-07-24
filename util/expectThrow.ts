export async function expectThrow(promise: Promise<any>) {
  try {
    await promise;
  } catch (error) {
    const invalidOpcode = error.message.search("invalid opcode") >= 0;
    const revert = error.message.search("revert") >= 0;
    assert(invalidOpcode || revert,
           "Expected throw, got '" + error + "' instead");
    return;
  }
  assert.fail("Expected throw not received");
}
