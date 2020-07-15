// SPDX-License-Identifier: UNLICENSED
// Taken from Argent's code base - https://github.com/argentlabs/argent-contracts/blob/develop/contracts/ens/ArgentENSManager.sol
// with few modifications.

pragma solidity ^0.6.10;

import "../../iface/ens/IENSManager.sol";
import "../../thirdparty/strings.sol";
import "../../lib/OwnerManagable.sol";
import "../../lib/SignatureUtil.sol";

/**
 * @title LoopringENSManager
 * @author Freeman Zhong - <kongliang@loopring.org>
 */
contract LoopringENSManager is IENSManager, OwnerManagable {

    using strings       for *;
    using BytesUtil     for bytes;
    using MathUint      for uint;

    string public rootName = "loopring.eth";

    // namehash("loopring.eth")
    bytes32 constant public LOOPRING_ROOT_NODE = 0x5c1eee8c1557a09e02b06677face65fb4793bb77c36e84a980a5ba6849153624;
    // namehash('addr.reverse')
    bytes32 constant public ADDR_REVERSE_NODE = 0x91d1777781884d03a6757a803996e38de2a42967fb37eeaca72729271025a9e2;

    // public ensRegistry address.
    // @see https://docs.ens.domains/ens-deployments for more detailed.
    address public ensRegistry = 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e;

    address public ensResolver;

    event RootnodeOwnerChange(bytes32 indexed _rootnode, address indexed _newOwner);
    event ENSResolverChanged(address addr);
    event Registered(address indexed _owner, string _ens);
    event Unregistered(string _ens);

    constructor(
        address _ensResolver
        )
        public
    {
        ensResolver = _ensResolver;
    }

    function changeRootnodeOwner(address _newOwner) external override onlyOwner {
        getENSRegistry().setOwner(LOOPRING_ROOT_NODE, _newOwner);
        emit RootnodeOwnerChange(LOOPRING_ROOT_NODE, _newOwner);
    }

    function changeENSResolver(address _ensResolver) external onlyOwner {
        require(_ensResolver != address(0), "ZERO_ADDRESS");
        ensResolver = _ensResolver;
        emit ENSResolverChanged(_ensResolver);
    }

    function register(
        address _owner,
        string  calldata _label,
        bytes   calldata _approval
        )
        external
        override
        onlyManager
    {
        verifyApproval(_owner, _label, _approval);

        bytes32 labelNode = keccak256(abi.encodePacked(_label));
        bytes32 node = keccak256(abi.encodePacked(LOOPRING_ROOT_NODE, labelNode));
        address currentOwner = getENSRegistry().owner(node);
        require(currentOwner == address(0), "LABEL_ALREALDY_OWNED");

        // Forward ENS
        getENSRegistry().setSubnodeOwner(LOOPRING_ROOT_NODE, labelNode, address(this));
        getENSRegistry().setResolver(node, ensResolver);
        getENSRegistry().setOwner(node, _owner);
        ENSResolver(ensResolver).setAddr(node, _owner);

        // Reverse ENS
        strings.slice[] memory parts = new strings.slice[](2);
        parts[0] = _label.toSlice();
        parts[1] = rootName.toSlice();
        string memory name = ".".toSlice().join(parts);
        bytes32 reverseNode = getENSReverseRegistrar().node(_owner);
        getENSReverseRegistrar.setName(name);
        ENSResolver(ensResolver).setName(reverseNode, name);

        emit Registered(_owner, name);
    }

    function resolveName(address _owner) public view override returns (string memory) {
        bytes32 reverseNode = getENSReverseRegistrar().node(_owner);
        return ENSResolver(ensResolver).name(reverseNode);
    }

    function isAvailable(bytes32 _subnode) public view override returns (bool) {
        bytes32 node = keccak256(abi.encodePacked(LOOPRING_ROOT_NODE, _subnode));
        address currentOwner = getENSRegistry().owner(node);
        if(currentOwner == address(0)) {
            return true;
        }
        return false;
    }

    function verifyApproval(
        address _owner,
        string  memory _label,
        bytes   memory _approval
        )
        internal
        view
    {
        if (numManagers() == 1) {
            return;
        }

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                _owner,
                _label
            )
        );

        bytes32 hash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                messageHash
            )
        );

        address signer = SignatureUtil.recoverECDSASigner(hash, _approval);
        require(isManager(signer), "UNAUTHORIZED");
    }

    function resolveEns(bytes32 _node) public view returns (address) {
        address resolver = getENSRegistry().resolver(_node);
        return ENSResolver(resolver).addr(_node);
    }

    function getENSRegistry() public view returns (ENSRegistry) {
        return ENSRegistry(ensRegistry);
    }

    function getENSReverseRegistrar() public view returns (ENSReverseRegistrar) {
        return ENSReverseRegistrar(getENSRegistry().owner(ADDR_REVERSE_NODE));
    }

}
