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

pragma solidity 0.4.24;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

import "../iface/Errors.sol";
import "../iface/IFeeHolder.sol";
import "../lib/BurnableERC20.sol";
import "../lib/MathUint.sol";
import "../lib/NoDefaultFunc.sol";

/// @author Brecht Devos - <brecht@loopring.org>
contract TaxManager is NoDefaultFunc, Errors {
    using MathUint for uint;

    address public feeHolderAddress = 0x0;
    address public lrcAddress = 0x0;

    constructor(
        address _feeHolderAddress,
        address _lrcAddress
        )
        public
    {
        require(_feeHolderAddress != 0x0, ZERO_ADDRESS);
        require(_lrcAddress != 0x0, ZERO_ADDRESS);
        feeHolderAddress = _feeHolderAddress;
        lrcAddress = _lrcAddress;
    }

    function burn(address token)
        external
        returns (bool)
    {
        IFeeHolder feeHolder = IFeeHolder(feeHolderAddress);

        // Withdraw the complete token balance
        uint balance = feeHolder.feeBalances(feeHolderAddress, token);
        bool success = feeHolder.withdrawTax(token, balance);
        require(success, WITHDRAWAL_FAILURE);

        // We currently only support burning LRC directly
        if (token != lrcAddress) {
            require(false, UNIMPLEMENTED);
        }

        // Burn the LRC
        BurnableERC20 LRC = BurnableERC20(lrcAddress);
        success = LRC.burn(balance);
        require(success, BURN_FAILURE);

        return true;
    }

}
