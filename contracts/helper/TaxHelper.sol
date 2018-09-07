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

import "../impl/Data.sol";
import "../lib/MathUint.sol";


/// @title TaxHelper
/// @author Brecht Devos - <brecht@loopring.org>.
library TaxHelper {
    using MathUint      for uint;

    enum TokenType { LRC, ETH, Other }

    function calculateTax(
        Data.Tax tax,
        address token,
        bool P2P,
        uint amount
        )
        internal
        pure
        returns (uint)
    {
        if (amount == 0) {
            return 0;
        }
        uint taxRate = getTaxRate(tax, token, P2P);
        return amount.mul(taxRate) / tax.percentageBase;
    }

    function getTokenType(Data.Tax tax, address token)
        internal
        pure
        returns (TokenType)
    {
        if (token == tax.lrcTokenAddress) {
            return TokenType.LRC;
        } else if (token == tax.wethTokenAddress) {
            return TokenType.ETH;
        } else {
            return TokenType.Other;
        }
    }

    function getTaxRate(Data.Tax tax, address token, bool P2P)
        internal
        pure
        returns (uint taxRate)
    {
        uint offset = P2P ? 3 : 0;
        offset += uint(getTokenType(tax, token));
        assembly {
            taxRate := mload(add(tax, mul(offset, 32)))
        }
    }
}
