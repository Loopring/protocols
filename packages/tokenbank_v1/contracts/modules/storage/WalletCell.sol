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

import "../../lib/NamedAddressSet.sol";
import "../../lib/Ownable.sol";


/// @title WalletCell
/// @dev Persists data regarding a wallet's security settings.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract WalletCell is Ownable, NamedAddressSet
{
    address private owner;
    string  private GUARDIAN = "__GUARDIAN__";
    uint    public  lock;

    constructor() public Ownable() {}

    function setLock(uint _lock)
        external
        onlyOwner
    {
        lock = _lock;
    }

    function addGuardian(address _guardian)
        external
        onlyOwner
    {
        addAddressToSet(GUARDIAN, _guardian, true);
    }

    function guardians()
        external
        view
        returns(address[] memory)
    {
        return addressesInSet(GUARDIAN);
    }

    function guardianCount()
        external
        view
        returns(uint)
    {
        return numAddressesInSet(GUARDIAN);
    }
}
