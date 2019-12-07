// From Compound code base - https://github.com/compound-finance/compound-protocol/blob/master/contracts/PriceOracle.sol
// with minor modificaiton.
pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "./CToken.sol";


interface ComptrollerPriceOracle {
    /**
     * @notice Indicator that this is a PriceOracle contract (for inspection)
     */
    function isPriceOracle() external pure returns (bool);

    /**
      * @notice Get the underlying price of a cToken asset
      * @param cToken The cToken to get the underlying price of
      * @return The underlying asset price mantissa (scaled by 1e18).
      *  Zero means the price is unavailable.
      */
    function getUnderlyingPrice(CToken cToken) external view returns (uint);
}
