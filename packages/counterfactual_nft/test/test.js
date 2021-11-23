const truffleAssert = require('truffle-assertions');
var assert = require('assert');
const BigNumber = require('bignumber.js');

const NFTFactory = artifacts.require("NFTFactory.sol");
const CounterfactualNFT = artifacts.require("CounterfactualNFT.sol");

contract("NFT", (accounts) => {
  const ownerA = accounts[0];
  const ownerB = accounts[1];
  const minterA = accounts[2];
  const minterB = accounts[3];
  const userA = accounts[4];
  const userB = accounts[5];

  let factory;

  before(async () => {
    factory = await NFTFactory.deployed();
  });

  it("Counterfactual flow", async () => {
    const owner = ownerA;
    const nftTokenAddress = await factory.computeNftContractAddress(owner, "");

    const tx = await factory.createNftContract(owner, "");
    //console.log("Deployment cost: " + tx.receipt.gasUsed);

    // Check if the contract was deployed to the expected address
    truffleAssert.eventEmitted(tx, 'NFTContractCreated', (ev) => {
      return ev.nftContract === nftTokenAddress && ev.owner === owner && ev.baseURI === "";
    });

    const nft = await CounterfactualNFT.at(nftTokenAddress);

    // Owner needs to be set to the expected owner
    assert.equal(await nft.owner(), owner, "unexpected owner");

    // Owner needs to be able to mint an NFT on L1
    const tokenID = "82074012285391930765279489314136667830573876033924668146917021887792317657586";
    await nft.mint(userB, tokenID, "1", "0x", {from: owner});

    // Check if the IPFS URI is correctly returned for the minted NFT
    const uri = await nft.uri(tokenID);
    assert(uri === "ipfs://QmaYyJx2RTHY7aGLSNX7xEzSYeh8SHU2eLNcVB1XXgzuv9/metadata.json", "unexpected uri");

    // The owner needs to be a minter
    assert.deepEqual(await nft.minters(), [owner], "unexpected minters");
    assert(await nft.isMinter(owner), "owner needs to be a minter");

    // Add a new minter
    await nft.setMinter(userB, true, {from: owner});
    assert.deepEqual(await nft.minters(), [userB, owner], "unexpected minters");
    assert(await nft.isMinter(userB), "new minter needs to be enabled");

    // Remove a minter
    await nft.setMinter(userB, false, {from: owner});
    assert.deepEqual(await nft.minters(), [userB, owner], "unexpected minters");
    assert(!(await nft.isMinter(userB)), "new minter needs to be disabled");

    // Transfer ownership to a new owner
    // The old owner still needs to be a deprecated minter
    await nft.transferOwnership(ownerB, {from: ownerA});
    assert.equal(await nft.owner(), ownerB, "unexpected owner");
    assert.deepEqual(await nft.minters(), [userB, ownerA, ownerB], "unexpected minters");
    assert(!(await nft.isMinter(ownerA)), "previous owner needs to be disabled");
    assert(await nft.isMinter(ownerB), "current owner needs to be enabled");
  });
});