// Taken from Argent's code base - https://github.com/argentlabs/argent-contracts/blob/develop/contracts/ens/ArgentENSManager.sol
// with few modifications.

pragma solidity ^0.5.13;
import "../strings.sol";
import "./ENS.sol";
import "./ENSConsumer.sol";
import "../../lib/OwnerManagable.sol";

/**
 * @dev Interface for an ENS Mananger.
 */
interface IENSManager {
    function changeRootnodeOwner(address _newOwner) external;
    function register(string calldata _label, address _owner) external;
    function isAvailable(bytes32 _subnode) external view returns(bool);
}

/**
 * @title BaseENSManager
 * @dev Implementation of an ENS manager that orchestrates the complete
 * registration of subdomains for a single root (e.g. argent.eth).
 * The contract defines a manager role who is the only role that can trigger the registration of
 * a new subdomain.
 * @author Julien Niset - <julien@argent.im>
 */
contract BaseENSManager is IENSManager, OwnerManagable, ENSConsumer {

    using strings for *;

    // The managed root name
    string public rootName;
    // The managed root node
    bytes32 public rootNode;
    // The address of the ENS resolver
    address public ensResolver;

    // *************** Events *************************** //

    event RootnodeOwnerChange(bytes32 indexed _rootnode, address indexed _newOwner);
    event ENSResolverChanged(address addr);
    event Registered(address indexed _owner, string _ens);
    event Unregistered(string _ens);

    // *************** Constructor ********************** //

    /**
     * @dev Constructor that sets the ENS root name and root node to manage.
     * @param _rootName The root name (e.g. argentx.eth).
     * @param _rootNode The node of the root name (e.g. namehash(argentx.eth)).
     */
    constructor(string memory _rootName, bytes32 _rootNode, address _ensRegistry, address _ensResolver) ENSConsumer(_ensRegistry) public {
        rootName = _rootName;
        rootNode = _rootNode;
        ensResolver = _ensResolver;
    }

    // *************** External Functions ********************* //

    /**
     * @dev This function must be called when the ENS Manager contract is replaced
     * and the address of the new Manager should be provided.
     * @param _newOwner The address of the new ENS manager that will manage the root node.
     */
    function changeRootnodeOwner(address _newOwner) external onlyOwner {
        getENSRegistry().setOwner(rootNode, _newOwner);
        emit RootnodeOwnerChange(rootNode, _newOwner);
    }

    /**
     * @dev Lets the owner change the address of the ENS resolver contract.
     * @param _ensResolver The address of the ENS resolver contract.
     */
    function changeENSResolver(address _ensResolver) external onlyOwner {
        require(_ensResolver != address(0), "WF: address cannot be null");
        ensResolver = _ensResolver;
        emit ENSResolverChanged(_ensResolver);
    }

    /**
    * @dev Lets the manager assign an ENS subdomain of the root node to a target address.
    * Registers both the forward and reverse ENS.
    * @param _owner The owner of the subdomain.
    * @param _label The subdomain label.
    */
    function register(address _owner, string calldata _label) external onlyManager {
        bytes32 labelNode = keccak256(abi.encodePacked(_label));
        bytes32 node = keccak256(abi.encodePacked(rootNode, labelNode));
        address currentOwner = getENSRegistry().owner(node);
        require(currentOwner == address(0), "AEM: _label is alrealdy owned");

        // Forward ENS
        getENSRegistry().setSubnodeOwner(rootNode, labelNode, address(this));
        getENSRegistry().setResolver(node, ensResolver);
        getENSRegistry().setOwner(node, _owner);
        ENSResolver(ensResolver).setAddr(node, _owner);

        // Reverse ENS
        strings.slice[] memory parts = new strings.slice[](2);
        parts[0] = _label.toSlice();
        parts[1] = rootName.toSlice();
        string memory name = ".".toSlice().join(parts);
        bytes32 reverseNode = getENSReverseRegistrar().node(_owner);
        ENSResolver(ensResolver).setName(reverseNode, name);

        emit Registered(_owner, name);
    }

    // *************** Public Functions ********************* //

    /**
     * @dev Returns true is a given subnode is available.
     * @param _subnode The target subnode.
     * @return true if the subnode is available.
     */
    function isAvailable(bytes32 _subnode) public view returns (bool) {
        bytes32 node = keccak256(abi.encodePacked(rootNode, _subnode));
        address currentOwner = getENSRegistry().owner(node);
        if(currentOwner == address(0)) {
            return true;
        }
        return false;
    }
}
