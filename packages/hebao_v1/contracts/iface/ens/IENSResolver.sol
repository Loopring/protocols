// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.10;

/**
 * ENS Resolver interface.
 */
interface IENSResolver {
    function addr(bytes32 _node) public view virtual returns (address);
    function setAddr(bytes32 _node, address _addr) public virtual;
    function name(bytes32 _node) public view virtual returns (string memory);
    function setName(bytes32 _node, string memory _name) public virtual;
}
