import BN = require("bn.js");
import { Context } from "./TestUtils";
import { Constants } from "./Constants";

interface Tokens {
  symbolAddrMap: Map<string, string>;
  addrSymbolMap: Map<string, string>;
  addrInstanceMap: Map<string, any>;
}

async function getTokens(ctx: Context) {
  const tokens: Tokens = {
    symbolAddrMap: new Map<string, string>(),
    addrSymbolMap: new Map<string, string>(),
    addrInstanceMap: new Map<string, any>()
  };

  const contracts = ctx.contracts;
  const [eth, weth, lrc, gto, rdn, rep, inda, indb] = await Promise.all([
    null,
    contracts.WETHToken.deployed(),
    contracts.LRCToken.deployed(),
    contracts.GTOToken.deployed(),
    contracts.RDNToken.deployed(),
    contracts.REPToken.deployed(),
    contracts.INDAToken.deployed(),
    contracts.INDBToken.deployed()
  ]);

  tokens.symbolAddrMap.set("ETH", Constants.zeroAddress);
  tokens.symbolAddrMap.set("WETH", contracts.WETHToken.address);
  tokens.symbolAddrMap.set("LRC", contracts.LRCToken.address);
  tokens.symbolAddrMap.set("GTO", contracts.GTOToken.address);
  tokens.symbolAddrMap.set("RDN", contracts.RDNToken.address);
  tokens.symbolAddrMap.set("REP", contracts.REPToken.address);
  tokens.symbolAddrMap.set("INDA", contracts.INDAToken.address);
  tokens.symbolAddrMap.set("INDB", contracts.INDBToken.address);

  tokens.addrSymbolMap.set(Constants.zeroAddress, "ETH");
  tokens.addrSymbolMap.set(contracts.WETHToken.address, "WETH");
  tokens.addrSymbolMap.set(contracts.LRCToken.address, "LRC");
  tokens.addrSymbolMap.set(contracts.GTOToken.address, "GTO");
  tokens.addrSymbolMap.set(contracts.RDNToken.address, "RDN");
  tokens.addrSymbolMap.set(contracts.REPToken.address, "REP");
  tokens.addrSymbolMap.set(contracts.INDAToken.address, "INDA");
  tokens.addrSymbolMap.set(contracts.INDBToken.address, "INDB");

  tokens.addrInstanceMap.set(Constants.zeroAddress, null);
  tokens.addrInstanceMap.set(contracts.WETHToken.address, weth);
  tokens.addrInstanceMap.set(contracts.LRCToken.address, lrc);
  tokens.addrInstanceMap.set(contracts.GTOToken.address, gto);
  tokens.addrInstanceMap.set(contracts.RDNToken.address, rdn);
  tokens.addrInstanceMap.set(contracts.REPToken.address, rep);
  tokens.addrInstanceMap.set(contracts.INDAToken.address, inda);
  tokens.addrInstanceMap.set(contracts.INDBToken.address, indb);

  return tokens;
}

export async function getTokenContract(ctx: Context, token: string) {
  const tokens = await getTokens(ctx);
  if (!token.startsWith("0x")) {
    token = tokens.symbolAddrMap.get(token);
  }
  return await ctx.contracts.DummyToken.at(token);
}

export async function getTokenAddress(ctx: Context, token: string) {
  if (token === Constants.zeroAddress || token === "ETH") {
    return Constants.zeroAddress;
  } else {
    const Token = await getTokenContract(ctx, token);
    return Token.address;
  }
}

export async function getBalance(ctx: Context, token: string, owner: string) {
  if (!token.startsWith("0x")) {
    token = await getTokenAddress(ctx, token);
  }
  if (token === Constants.zeroAddress) {
    return new BN(await web3.eth.getBalance(owner));
  } else {
    const Token = await ctx.contracts.DummyToken.at(token);
    return await Token.balanceOf(owner);
  }
}

export async function getAllowance(
  ctx: Context,
  token: string,
  owner: string,
  spender: string
) {
  if (!token.startsWith("0x")) {
    token = await getTokenAddress(ctx, token);
  }
  const Token = await ctx.contracts.DummyToken.at(token);
  return await Token.allowance(owner, spender);
}

export async function addBalance(
  ctx: Context,
  owner: string,
  token: string,
  amount: BN
) {
  // Transfer balances from the deployer
  await transferFrom(ctx, web3.eth.defaultAccount, owner, token, amount);
}

export async function transferFrom(
  ctx: Context,
  from: string,
  to: string,
  token: string,
  amount: BN
) {
  if (token === Constants.zeroAddress || token === "ETH") {
    await web3.eth.sendTransaction({ from, to, value: amount });
  } else {
    const Token = await getTokenContract(ctx, token);
    await Token.transfer(to, amount, { from });
  }
}
