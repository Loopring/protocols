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
pragma experimental ABIEncoderV2;

import "../../base/BaseSubAccount.sol";
import "../../lib/Ownable.sol";
import "../security/SecurityModule.sol";

interface ICToken {
    function comptroller() external view returns (address);
    function underlying() external view returns (address);
    function symbol() external view returns (string memory);
    function exchangeRateCurrent() external returns (uint256);
    function exchangeRateStored() external view returns (uint256);
    function balanceOf(address _account) external view returns (uint256);
    function borrowBalanceCurrent(address _account) external returns (uint256);
    function borrowBalanceStored(address _account) external view returns (uint256);
}

contract CompoundRegistry is Ownable {

    address[] tokens;

    mapping (address => CTokenInfo) internal cToken;

    struct CTokenInfo {
        bool exists;
        uint128 index;
        address market;
    }

    event CTokenAdded(address indexed _underlying, address indexed _cToken);
    event CTokenRemoved(address indexed _underlying);

    /**
     * @dev Adds a new cToken to the registry.
     * @param _underlying The underlying asset.
     * @param _cToken The cToken.
     */
    function addCToken(address _underlying, address _cToken) external onlyOwner {
        require(!cToken[_underlying].exists, "CR: cToken already added");
        cToken[_underlying].exists = true;
        cToken[_underlying].index = uint128(tokens.push(_underlying) - 1);
        cToken[_underlying].market = _cToken;
        emit CTokenAdded(_underlying, _cToken);
    }

    /**
     * @dev Removes a cToken from the registry.
     * @param _underlying The underlying asset.
     */
    function removeCToken(address _underlying) external onlyOwner {
        require(cToken[_underlying].exists, "CR: cToken does not exist");
        address last = tokens[tokens.length - 1];
        if(_underlying != last) {
            uint128 targetIndex = cToken[_underlying].index;
            tokens[targetIndex] = last;
            cToken[last].index = targetIndex;
        }
        tokens.length --;
        delete cToken[_underlying];
        emit CTokenRemoved(_underlying);
    }

    /**
     * @dev Gets the cToken for a given underlying asset.
     * @param _underlying The underlying asset.
     */
    function getCToken(address _underlying) external view returns (address) {
        return cToken[_underlying].market;
    }

    /**
    * @dev Gets the list of supported underlyings.
    */
    function listUnderlyings() external view returns (address[] memory) {
        address[] memory underlyings = new address[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            underlyings[i] = tokens[i];
        }
        return underlyings;
    }
}

/// @title CompoundModule
contract CompoundModule is BaseSubAccount, SecurityModule
{
    CompoundRegistry internal compoundRegistry;
    address constant internal ETH_TOKEN_ADDRESS = address(0);

    constructor(
        Controller _controller,
        CompoundRegistry _compoundRegistry
    )
        public
        SecurityModule(_controller)
    {
        compoundRegistry = _compoundRegistry;
    }

    /// @dev Fund Compound for earn interests and automatically enters market
    ///      so the funds will be used as collateral; or return borrowed assets
    ///      back to Compound.
    function deposit(
        address            wallet,
        address[] calldata signers,
        address            token,
        uint               amount
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        // TODO: enable signers later
        require(signers.length == 0, "NOT_SUPPORT_NOW");

        require(amount != 0, "ZERO_DEPOSIT");

        address cToken = compoundRegistry.getCToken(token);
        require(cToken != address(0), "NO_MARKET");

        mint(wallet, cToken, token, amount);
        trackDeposit(wallet, token, amount);
    }

    /// @dev Redeem fund from Compound.
    function withdraw(
        address            wallet,
        address[] calldata signers,
        address            token,
        uint               amount
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        // TODO: enable signers later
        require(signers.length == 0, "NOT_SUPPORT_NOW");

        address cToken = compoundRegistry.getCToken(token);
        require(cToken != address(0), "NO_MARKET");

        uint balance = uint(tokenBalance(wallet, token));
        require(amount > 0 && amount <= balance, "INVALID_WITHDRAW_AMOUNT");

        redeem(wallet, cToken, amount);
        trackWithdrawal(wallet, token, amount);
    }

    function tokenBalance (
        address wallet,
        address token
    )
        public
        view
        returns (int)
    {
        address cToken = compoundRegistry.getCToken(token);
        require(cToken != address(0), "NO_MARKET");

        uint amount = ICToken(cToken).balanceOf(address(wallet));
        uint exchangeRateMantissa = ICToken(cToken).exchangeRateStored();
        uint tokenValue = amount.mul(exchangeRateMantissa).div(10 ** 18);
        return int(tokenValue);
    }

    function tokenBalances(
        address wallet,
        address[] memory tokens
    )
        public
        view
        returns (int[] memory balances)
    {
        require(tokens.length > 0, "EMPTY_TOKENS");
        balances = new int[](tokens.length);
        for (uint i = 0; i < tokens.length; ++i)
        {
            balances[i] = tokenBalance(wallet, tokens[i]);
        }
    }

    // internal functions for invest
    // ...
    function mint(address _wallet, address _cToken, address _token, uint256 _amount) internal {
        if(_token == ETH_TOKEN_ADDRESS) {
            transactCall(_wallet, _cToken, _amount, abi.encodeWithSignature("mint()"));
        } else {
            transactCall(_wallet, _token, 0, abi.encodeWithSignature("approve(address,uint256)", _cToken, _amount));
            transactCall(_wallet, _cToken, 0, abi.encodeWithSignature("mint(uint256)", _amount));
        }
    }

    function redeem(address _wallet, address _cToken, uint256 _amount) internal {
        transactCall(_wallet, _cToken, 0, abi.encodeWithSignature("redeemUnderlying(uint256)", _amount));
    }
}
