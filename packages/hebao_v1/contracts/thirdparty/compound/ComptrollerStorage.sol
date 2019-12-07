// From Compound code base - https://github.com/compound-finance/compound-protocol/blob/master/contracts/ComptrollerStorage.sol
// with minor modificaiton.
pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "./CToken.sol";
import "./ComptrollerPriceOracle.sol";


contract ComptrollerV1Storage {

    /**
     * @notice Oracle which gives the price of any given asset
     */
    ComptrollerPriceOracle public oracle;

    /**
     * @notice Multiplier used to calculate the maximum repayAmount when liquidating a borrow
     */
    uint public closeFactorMantissa;

    /**
     * @notice Multiplier representing the discount on collateral that a liquidator receives
     */
    uint public liquidationIncentiveMantissa;

    /**
     * @notice Max number of assets a single account can participate in (borrow or use as collateral)
     */
    uint public maxAssets;

    /**
     * @notice Per-account mapping of "assets you are in", capped by maxAssets
     */
    mapping(address => CToken[]) public accountAssets;

}

contract ComptrollerV2Storage is ComptrollerV1Storage {
    struct Market {
        /**
         * @notice Whether or not this market is listed
         */
        bool isListed;

        /**
         * @notice Multiplier representing the most one can borrow against their collateral in this market.
         *  For instance, 0.9 to allow borrowing 90% of collateral value.
         *  Must be between 0 and 1, and stored as a mantissa.
         */
        uint collateralFactorMantissa;

        /**
         * @notice Per-market mapping of "accounts in this asset"
         */
        mapping(address => bool) accountMembership;
    }

    /**
     * @notice Official mapping of cTokens -> Market metadata
     * @dev Used e.g. to determine if a market is supported
     */
    mapping(address => Market) public markets;


    /**
     * @notice The Pause Guardian can pause certain actions as a safety mechanism. Actions which allow users to remove their own assets cannot be paused.
     */
    address public pauseGuardian;
    bool public mintGuardianPaused;
    bool public borrowGuardianPaused;
    bool public transferGuardianPaused;
    bool public seizeGuardianPaused;
}
