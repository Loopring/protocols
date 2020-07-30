// SPDX-License-Identifier: UNLICENSED
// From Argent code base - https://github.com/argentlabs/argent-contracts/blob/develop/contracts/defi/utils/CompoundRegistry.sol
// with minor modificaiton.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/Claimable.sol";


contract CompoundRegistry is Claimable {

    address[] public tokens;

    mapping (address => CTokenInfo) internal cTokens;

    struct CTokenInfo {
        uint    index;
        address market;
    }

    event CTokenAdded(address indexed _underlying, address indexed _cToken);
    event CTokenRemoved(address indexed _underlying);

    /// @dev Adds a new cToken to the registry.
    /// @param _underlying The underlying asset.
    /// @param _cToken The cToken
    function addCToken(address _underlying, address _cToken) external onlyOwner {
        require(cTokens[_underlying].index == 0, "CR: cToken already added");
        tokens.push(_underlying);
        cTokens[_underlying].index = uint128(tokens.length);
        cTokens[_underlying].market = _cToken;
        emit CTokenAdded(_underlying, _cToken);
    }

    /// @dev Removes a cToken from the registry.
    /// @param _underlying The underlying asset.
    function removeCToken(address _underlying) external onlyOwner {
        require(cTokens[_underlying].index > 0, "CR: cToken does not exist");
        address last = tokens[tokens.length - 1];
        if(_underlying != last) {
            uint targetIndex = cTokens[_underlying].index;
            tokens[targetIndex] = last;
            cTokens[last].index = targetIndex;
        }
        tokens.pop();
        delete cTokens[_underlying];
        emit CTokenRemoved(_underlying);
    }

    /// @dev Gets the cToken for a given underlying asset.
    /// @param _underlying The underlying asset.
    function getCToken(address _underlying) external view returns (address) {
        return cTokens[_underlying].market;
    }
}
