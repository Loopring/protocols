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
pragma solidity ^0.4.11;

import "./StandardToken.sol";


/// @title A ERC20 Token for Testing.
/// For more information about this token sale, please visit https://loopring.org
/// @author Daniel Wang - <daniel@loopring.org>.
contract TestToken is StandardToken {
    string public constant name     = "TestToken";
    string public constant symbol   = "TST";
    uint   public constant decimals = 18;

    event Issue(address recipient, uint amount);

    function TestToken() {}

    /// @dev Issue token.
    function issueToken(address recipient, uint amount) public {
        require(amount > 0);

        uint tstAmount = amount * 1E18;
        totalSupply = totalSupply.add(tstAmount);
        balances[recipient] = balances[recipient].add(tstAmount);

        Issue(recipient, tstAmount);
    }
}

