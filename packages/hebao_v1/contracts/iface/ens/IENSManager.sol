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
