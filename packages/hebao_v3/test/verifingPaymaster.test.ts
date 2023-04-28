import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("verifingPaymaster test", () => {
  async function fixture() {
    const signers = await ethers.getSigners();
    const owner = signers[0];
    const other = signers[1];
    const paymaster = await (
      await ethers.getContractFactory("VerifyingPaymaster")
    ).deploy(ethers.constants.AddressZero, owner.address);
    return { paymaster, owner, other };
  }
  it("admin operation success", async () => {
    const { paymaster, owner, other } = await loadFixture(fixture);
    // expect owner to be admin
    expect(await paymaster.hasRole(paymaster.ADMIN(), owner.address)).to.be
      .true;
    // add other to be admin
    expect(await paymaster.hasRole(paymaster.ADMIN(), other.address)).to.be
      .false;
    await paymaster.grantRole(paymaster.ADMIN(), other.address);
    expect(await paymaster.hasRole(paymaster.ADMIN(), other.address)).to.be
      .true;
  });
});
