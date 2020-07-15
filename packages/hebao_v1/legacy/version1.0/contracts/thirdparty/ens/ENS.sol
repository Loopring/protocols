// SPDX-License-Identifier: UNLICENSED
// Taken from Argent's code base - https://github.com/argentlabs/argent-contracts/blob/develop/contracts/ens/ENS.sol
// with few modifications.

pragma solidity ^0.6.10;

/**
 * @dev Interface for an ENS Mananger.
 */
interface IENSManager {
    function changeRootnodeOwner(address _newOwner) external;

    function isAvailable(bytes32 _subnode) external view returns(bool);

    function resolveName(address _owner) external view returns (string memory);

    function register(
        address _owner,
        string  calldata _label,
        bytes   calldata _approval
    ) external;
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
