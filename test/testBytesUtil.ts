import ABI = require("ethereumjs-abi");
import { expectThrow } from "protocol2-js";

const BytesUtilWrapper = artifacts.require("BytesUtilWrapper");

contract("BytesUtil", (accounts: string[]) => {

  let bytesUtil: any;

  const data = "9d3d523e2fe432c0367b062958133bb42b989f701140c27f50997c8305b553ea" +
               "72282c4dbbb49affd9cf757ea9797f976e1b9641ce76b2fe3d54d0a209462458" +
               "b82fe5dc2acd02ceec25beeb647a7d24d23dac3baa5eb97fc27d85d22a82a0ce" +
               "92a37bc14ca1223bda2702ee9d0169ca8c01412d42acf2cec4088211b8d5404b";
  const dataLength = data.length / 2;

  const revertMessage = "INVALID_SIZE";

  const bytesToBytes32Checked = async (offset: number) => {
    const numBytes = 32;
    const extracted = await bytesUtil.bytesToBytes32("0x" + data, offset);
    assert.equal(extracted, "0x" + data.slice(offset * 2, (offset + numBytes) * 2));
  };

  const bytesToUintChecked = async (offset: number) => {
    const numBytes = 32;
    const extracted = (await bytesUtil.bytesToUint("0x" + data, offset)).toString(16);
    assert.equal(extracted, data.slice(offset * 2, (offset + numBytes) * 2));
  };

  const bytesToAddressChecked = async (offset: number) => {
    const numBytes = 20;
    const extracted = await bytesUtil.bytesToAddress("0x" + data, offset);
    assert.equal(extracted, "0x" + data.slice(offset * 2, (offset + numBytes) * 2));
  };

  const bytesToUint16Checked = async (offset: number) => {
    const numBytes = 2;
    const extracted = (await bytesUtil.bytesToUint16("0x" + data, offset)).toString(16);
    assert.equal(extracted, data.slice(offset * 2, (offset + numBytes) * 2));
  };

  before(async () => {
    bytesUtil = await BytesUtilWrapper.new();
  });

  it("should be able to extract a bytes32", async () => {
    await bytesToBytes32Checked(0);
    await bytesToBytes32Checked(7);
    await bytesToBytes32Checked(32);
    await bytesToBytes32Checked(dataLength - 32);
  });

  it("should not be able to extract a bytes32 out of range", async () => {
    await expectThrow(bytesToBytes32Checked(dataLength - 31), revertMessage);
    await expectThrow(bytesToBytes32Checked(data.length), revertMessage);
    await expectThrow(bytesToBytes32Checked(data.length + 5), revertMessage);
  });

  it("should be able to extract a uint256", async () => {
    await bytesToUintChecked(0);
    await bytesToUintChecked(11);
    await bytesToUintChecked(32);
    await bytesToUintChecked(dataLength - 32);
  });

  it("should not be able to extract a uint256 out of range", async () => {
    await expectThrow(bytesToUintChecked(dataLength - 31), revertMessage);
    await expectThrow(bytesToUintChecked(data.length), revertMessage);
    await expectThrow(bytesToUintChecked(data.length + 5), revertMessage);
  });

  it("should be able to extract an address", async () => {
    await bytesToAddressChecked(0);
    await bytesToAddressChecked(11);
    await bytesToAddressChecked(32);
    await bytesToAddressChecked(dataLength - 20);
  });

  it("should not be able to extract an address out of range", async () => {
    await expectThrow(bytesToAddressChecked(dataLength - 19), revertMessage);
    await expectThrow(bytesToAddressChecked(data.length), revertMessage);
    await expectThrow(bytesToAddressChecked(data.length + 5), revertMessage);
  });

  it("should be able to extract a uint16", async () => {
    await bytesToUint16Checked(0);
    await bytesToUint16Checked(11);
    await bytesToUint16Checked(32);
    await bytesToUint16Checked(dataLength - 2);
  });

  it("should not be able to extract a uint16 out of range", async () => {
    await expectThrow(bytesToUint16Checked(dataLength - 1), revertMessage);
    await expectThrow(bytesToUint16Checked(data.length), revertMessage);
    await expectThrow(bytesToUint16Checked(data.length + 1), revertMessage);
  });

});
