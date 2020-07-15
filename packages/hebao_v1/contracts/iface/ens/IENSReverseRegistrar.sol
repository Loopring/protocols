// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.10;

/**
 * ENS Reverse Registrar interface.
 */
interface IENSReverseRegistrar {
    function claim(address _owner) public virtual returns (bytes32 _node);
    function claimWithResolver(address _owner, address _resolver) public virtual returns (bytes32);
    function setName(string memory _name) public virtual returns (bytes32);
    function node(address _addr) public view virtual returns (bytes32);
}
