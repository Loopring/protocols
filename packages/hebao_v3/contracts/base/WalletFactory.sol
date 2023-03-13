// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {SmartWallet, PriceOracle, IEntryPoint} from "./SmartWallet.sol";
import {WalletProxy} from "../thirdparty/proxies/WalletProxy.sol";

/**
 * A sample factory contract for SmartWallet
 * A UserOperations "initCode" holds the address of the factory, and a method call (to createAccount, in this sample factory).
 * The factory's createAccount returns the target account address even if it is already installed.
 * This way, the entryPoint.getSenderAddress() can be called either before or after the account is created.
 */
contract WalletFactory {
    SmartWallet public immutable accountImplementation;

    constructor(
        PriceOracle _priceOracle,
        IEntryPoint _entryPoint,
        address _blankOwner
    ) {
        accountImplementation = new SmartWallet(
            _priceOracle,
            _entryPoint,
            _blankOwner
        );
    }

    /**
     * create an account, and return its address.
     * returns the address even if the account is already deployed.
     * Note that during UserOperation execution, this method is called only if the account is not deployed.
     * This method returns an existing account address so that entryPoint.getSenderAddress() would work even after account creation
     */
    function createAccount(
        address owner,
        address[] calldata guardians,
        uint quota,
        address inheritor,
        uint256 salt
    ) public returns (SmartWallet ret) {
        address addr = getAddress(owner, guardians, quota, inheritor, salt);
        uint codeSize = addr.code.length;
        if (codeSize > 0) {
            return SmartWallet(payable(addr));
        }
        ret = SmartWallet(
            payable(
                new WalletProxy{salt: bytes32(salt)}(
                    address(accountImplementation),
                    abi.encodeCall(
                        SmartWallet.initialize,
                        (owner, guardians, quota, inheritor)
                    )
                )
            )
        );
    }

    /**
     * calculate the counterfactual address of this account as it would be returned by createAccount()
     */
    function getAddress(
        address owner,
        address[] calldata guardians,
        uint quota,
        address inheritor,
        uint256 salt
    ) public view returns (address) {
        return
            Create2.computeAddress(
                bytes32(salt),
                keccak256(
                    abi.encodePacked(
                        type(WalletProxy).creationCode,
                        abi.encode(
                            address(accountImplementation),
                            abi.encodeCall(
                                SmartWallet.initialize,
                                (owner, guardians, quota, inheritor)
                            )
                        )
                    )
                )
            );
    }
}
