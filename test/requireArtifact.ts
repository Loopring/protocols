
export async function requireArtifact(path: string) {
  const contract = artifacts.require(path);
  await sleep(1000);
  return contract;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
