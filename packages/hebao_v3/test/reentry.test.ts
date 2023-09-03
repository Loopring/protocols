import { ethers } from "hardhat";
import { expect, util } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { fixture } from "./helper/fixture";
import { deploySingle } from "./helper/utils";
import {
  BadEntryPoint__factory,
  EntryPoint__factory,
  EntrypointReentryAttacker__factory,
} from "../typechain-types";
import { utils } from "ethers";

describe("reentry attack test", () => {
  it("reentry attack bad implemented entrypoint", async () => {
    const { deployer, create2 } = await loadFixture(fixture);
    const entrypoint = BadEntryPoint__factory.connect(
      (await deploySingle(create2, "BadEntryPoint")).address,
      deployer
    );
    const signer = entrypoint.signer;
    const entryPoint = await entrypoint.address;
    const smallAmount = ethers.utils.parseEther("10");
    const attack = await new EntrypointReentryAttacker__factory(
      deployer
    ).deploy(entryPoint);
    await (
      await signer.sendTransaction({
        to: entryPoint,
        value: ethers.utils.parseEther("200"),
      })
    ).wait();
    await (
      await signer.sendTransaction({
        to: attack.address,
        value: ethers.utils.parseEther("10"),
      })
    ).wait();
    await (await attack.deposit({ value: smallAmount })).wait();
    await (await attack.unlockStake()).wait();
    await time.increase(20);
    const balanceBefore = await ethers.provider.getBalance(entryPoint);
    await (await attack.attack()).wait();
    const balanceAfter = await ethers.provider.getBalance(entryPoint);
    expect(balanceBefore.sub(balanceAfter).gt(utils.parseEther("10"))).to.be
      .true;
  });
  it("reentry attack entrypoint", async () => {
    const { deployer, create2 } = await loadFixture(fixture);
    const entrypoint = EntryPoint__factory.connect(
      (await deploySingle(create2, "EntryPoint")).address,
      deployer
    );
    const signer = entrypoint.signer;
    const entryPoint = await entrypoint.address;
    const smallAmount = ethers.utils.parseEther("10");
    const attack = await new EntrypointReentryAttacker__factory(
      deployer
    ).deploy(entryPoint);
    const unstakeDelaySec = 10;
    await (
      await signer.sendTransaction({
        to: entryPoint,
        value: ethers.utils.parseEther("200"),
      })
    ).wait();
    await (
      await signer.sendTransaction({
        to: attack.address,
        value: ethers.utils.parseEther("10"),
      })
    ).wait();
    await (await attack.deposit({ value: smallAmount })).wait();
    await (await attack.unlockStake()).wait();
    await time.increase(unstakeDelaySec + 1);
    await expect(attack.attack()).to.reverted;
  });
});
