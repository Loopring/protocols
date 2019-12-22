// Taken from Argent's code base - https://github.com/argentlabs/argent-contracts/blob/develop/contracts/ens/ENS.sol
// with few modifications.

pragma solidity ^0.6.0;

/**
 * ENS Registry interface.
 */
abstract contract ENSRegistry {
    function owner(bytes32 _node) public view virtual returns (address);
    function resolver(bytes32 _node) public view virtual  returns (address);
    function ttl(bytes32 _node) public view virtual  returns (uint64);
    function setOwner(bytes32 _node, address _owner) public virtual;
    function setSubnodeOwner(bytes32 _node, bytes32 _label, address _owner) public virtual;
    function setResolver(bytes32 _node, address _resolver) public virtual;
    function setTTL(bytes32 _node, uint64 _ttl) public virtual;
}

/**
 * ENS Resolver interface.
 */
abstract contract ENSResolver {
    function addr(bytes32 _node) public view virtual returns (address);
    function setAddr(bytes32 _node, address _addr) public virtual;
    function name(bytes32 _node) public view virtual returns (string memory);
    function setName(bytes32 _node, string memory _name) public virtual;
}

/**
 * ENS Reverse Registrar interface.
 */
abstract contract ENSReverseRegistrar {
    function claim(address _owner) public virtual returns (bytes32 _node);
    function claimWithResolver(address _owner, address _resolver) public virtual returns (bytes32);
    function setName(string memory _name) public virtual returns (bytes32);
    function node(address _addr) public virtual returns (bytes32);
}
