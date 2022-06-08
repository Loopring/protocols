// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./lib/OwnerManagable.sol";
import "./lib/BytesUtil.sol";
import "./lib/Drainable.sol";
import "./lib/ApprovalCheck.sol";
import "./thirdparty/erc165/IERC165.sol";
import "./thirdparty/erc1155/ERC1155Holder.sol";
import "./thirdparty/erc721/ERC721Holder.sol";

contract StakingBridge is OwnerManagable, Drainable, IERC165, ERC721Holder, ERC1155Holder, ApprovalCheck {
    using BytesUtil for bytes;

    mapping(address => mapping(bytes4 => bool)) public authorized;

    event CallSucceeded(uint callId, address target, bytes4 method);
    event CallReverted(uint callId, address target, bytes4 method);

    modifier withAccess(address target, bytes4 selector) {
        require(authorized[target][selector], "UNAUTHORIZED_CALLE");
        _;
    }

    receive() external payable { }

    function authorizeCall(address target, bytes4 selector)
        external
        onlyOwner
    {
        authorized[target][selector] = true;
    }

    function unauthorizeCall(address target, bytes4 selector)
        external
        onlyOwner
    {
        delete authorized[target][selector];
    }

    function setApproveSpender(address target, bool allowed)
        external
        onlyOwner
    {
        _setApproveSpender(target, allowed);
    }

    function call(uint callId, address target, bytes calldata data)
        payable
        external
        onlyManager(msg.sender)
        withAccess(target, data.toBytes4(0))
        isApprovalAllowed(data)
    {
        (bool success, /*bytes memory returnData*/) = target
            .call{value: msg.value}(data);

        if (success) {
	    emit CallSucceeded(callId, target, data.toBytes4(0));
        } else {
	    emit CallReverted(callId, target, data.toBytes4(0));
	}

    }

    function canDrain(address drainer, address /*token*/)
        public
        view
        override
        returns (bool)
    {
        return drainer == owner;
    }

    // ERC165
    function supportsInterface(
        bytes4 interfaceId
        )
        external
        pure
        override
        returns (bool)
    {
        return  interfaceId == type(IERC165).interfaceId ||
                interfaceId == type(IERC721Receiver).interfaceId ||
                interfaceId == type(IERC1155Receiver).interfaceId;
    }
}
