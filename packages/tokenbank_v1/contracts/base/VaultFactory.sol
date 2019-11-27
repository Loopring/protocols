/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity ^0.5.11;


contract VaultFactory
{
    function createVault(
        address[] calldata owners,
        uint               requirement
        )
        external
    {
        // bytes32 salt = keccak256(abi.encodePacked("VAULT_CREATION", subdomain));
        // bytes memory code = type(SimpleProxy).creationCode;
        // assembly {
        //     _wallet := create2(0, add(code, 0x20), mload(code), salt)
        //     if iszero(extcodesize(_wallet)) {
        //         revert(0, 0)
        //     }
        // }
        // SimpleProxy(_wallet).setImplementation(walletImplementation);
        // Wallet(_wallet).setup(_owner, _modules);

        // emit WalletCreated(_wallet, _owner);
    }
}
