
export async function requireArtifact(path: string) {
  const contract = artifacts.require(path);
  return contract;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
