// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

//import "../erc165/ERC165.sol";
import "./IERC1155Receiver.sol";

/**
 * @dev _Available since v3.1._
 */
abstract contract ERC1155Receiver is /*ERC165, */IERC1155Receiver {
    /*constructor() {
        _registerInterface(
            ERC1155Receiver(address(0)).onERC1155Received.selector ^
            ERC1155Receiver(address(0)).onERC1155BatchReceived.selector
        );
    }*/
}
