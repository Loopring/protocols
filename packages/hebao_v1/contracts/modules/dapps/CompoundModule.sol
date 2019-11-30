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

import "../../lib/MathUint.sol";
import "../dapps/CompoundRegistry.sol";
import "../dapps/LoanBaseModule.sol";
import "../security/SecurityModule.sol";

interface IComptroller {
    function enterMarkets(address[] calldata _cTokens) external returns (uint[] memory);
    function exitMarket(address _cToken) external returns (uint);
    function getAssetsIn(address _account) external view returns (address[] memory);
    function getAccountLiquidity(address _account) external view returns (uint, uint, uint);
    function checkMembership(address account, ICToken cToken) external view returns (bool);
}

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

/// @title CompoundModule
contract CompoundModule is SecurityModule, LoanBaseModule
{
    bytes32 constant NAME = "CompoundManager";

    // The Compound IComptroller contract
    IComptroller public comptroller;
    // The registry mapping underlying with cTokens
    CompoundRegistry public compoundRegistry;

    // Mock token address for ETH
    address constant internal ETH_TOKEN_ADDRESS = address(0);

    using MathUint for uint256;

    constructor(
        SecurityStore _securityStore,
        IComptroller _comptroller,
        CompoundRegistry _compoundRegistry
        )
        public
        SecurityModule(_securityStore)
    {
        comptroller = _comptroller;
        compoundRegistry = _compoundRegistry;
    }

    /* ********************************** Implementation of Loan ************************************* */

    /**
     * @dev Opens a collateralized loan.
     * @param _wallet The target wallet.
     * @param _collateral The token used as a collateral.
     * @param _collateralAmount The amount of collateral token provided.
     * @param _debtToken The token borrowed.
     * @param _debtAmount The amount of tokens borrowed.
     * @return bytes32(0) as Compound does not allow the creation of multiple loans.
     */
    function openLoan(
        BaseWallet _wallet,
        address _collateral,
        uint256 _collateralAmount,
        address _debtToken,
        uint256 _debtAmount
    )
        external
        onlyFromMetaTxOrWalletOwner(address(_wallet))
        onlyWhenWalletUnlocked(address(_wallet))
        returns (bytes32 _loanId)
    {
        address[] memory markets = new address[](2);
        markets[0] = compoundRegistry.getCToken(_collateral);
        markets[1] = compoundRegistry.getCToken(_debtToken);
        _wallet.transact(address(comptroller), 0, abi.encodeWithSignature("enterMarkets(address[])", markets));
        mint(_wallet, markets[0], _collateral, _collateralAmount);
        borrow(_wallet, markets[1], _debtAmount);
        emit LoanOpened(address(_wallet), _loanId, _collateral, _collateralAmount, _debtToken, _debtAmount);
    }

    /**
     * @dev Closes the collateralized loan in all markets by repaying all debts (plus interest). Note that it does not redeem the collateral.
     * @param _wallet The target wallet.
     * @param _loanId bytes32(0) as Compound does not allow the creation of multiple loans.
     */
    function closeLoan(
        BaseWallet _wallet,
        bytes32 _loanId
    )
        external
        onlyFromMetaTxOrWalletOwner(address(_wallet))
        onlyWhenWalletUnlocked(address(_wallet))
    {
        address[] memory markets = comptroller.getAssetsIn(address(_wallet));
        for(uint i = 0; i < markets.length; i++) {
            address cToken = markets[i];
            uint debt = ICToken(cToken).borrowBalanceCurrent(address(_wallet));
            if(debt > 0) {
                repayBorrow(_wallet, cToken, debt);
                uint collateral = ICToken(cToken).balanceOf(address(_wallet));
                if(collateral == 0) {
                    _wallet.transact(address(comptroller), 0, abi.encodeWithSignature("exitMarket(address)", address(cToken)));
                }
            }
        }
        emit LoanClosed(address(_wallet), _loanId);
    }

    /**
     * @dev Adds collateral to a loan identified by its ID.
     * @param _wallet The target wallet.
     * @param _loanId bytes32(0) as Compound does not allow the creation of multiple loans.
     * @param _collateral The token used as a collateral.
     * @param _collateralAmount The amount of collateral to add.
     */
    function addCollateral(
        BaseWallet _wallet,
        bytes32 _loanId,
        address _collateral,
        uint256 _collateralAmount
    )
        external
        onlyFromMetaTxOrWalletOwner(address(_wallet))
        onlyWhenWalletUnlocked(address(_wallet))
    {
        address cToken = compoundRegistry.getCToken(_collateral);
        enterMarketIfNeeded(_wallet, cToken, address(comptroller));
        mint(_wallet, cToken, _collateral, _collateralAmount);
        emit CollateralAdded(address(_wallet), _loanId, _collateral, _collateralAmount);
    }

    /**
     * @dev Removes collateral from a loan identified by its ID.
     * @param _wallet The target wallet.
     * @param _loanId bytes32(0) as Compound does not allow the creation of multiple loans.
     * @param _collateral The token used as a collateral.
     * @param _collateralAmount The amount of collateral to remove.
     */
    function removeCollateral(
        BaseWallet _wallet,
        bytes32 _loanId,
        address _collateral,
        uint256 _collateralAmount
    )
        external
        onlyFromMetaTxOrWalletOwner(address(_wallet))
        onlyWhenWalletUnlocked(address(_wallet))
    {
        address cToken = compoundRegistry.getCToken(_collateral);
        redeemUnderlying(_wallet, cToken, _collateralAmount);
        exitMarketIfNeeded(_wallet, cToken, address(comptroller));
        emit CollateralRemoved(address(_wallet), _loanId, _collateral, _collateralAmount);
    }

    /**
     * @dev Increases the debt by borrowing more token from a loan identified by its ID.
     * @param _wallet The target wallet.
     * @param _loanId bytes32(0) as Compound does not allow the creation of multiple loans.
     * @param _debtToken The token borrowed.
     * @param _debtAmount The amount of token to borrow.
     */
    function addDebt(
        BaseWallet _wallet,
        bytes32 _loanId,
        address _debtToken,
        uint256 _debtAmount
    )
        external
        onlyFromMetaTxOrWalletOwner(address(_wallet))
        onlyWhenWalletUnlocked(address(_wallet))
    {
        address dToken = compoundRegistry.getCToken(_debtToken);
        enterMarketIfNeeded(_wallet, dToken, address(comptroller));
        borrow(_wallet, dToken, _debtAmount);
        emit DebtAdded(address(_wallet), _loanId, _debtToken, _debtAmount);
    }

    /**
     * @dev Decreases the debt by repaying some token from a loan identified by its ID.
     * @param _wallet The target wallet.
     * @param _loanId bytes32(0) as Compound does not allow the creation of multiple loans.
     * @param _debtToken The token to repay.
     * @param _debtAmount The amount of token to repay.
     */
    function removeDebt(
        BaseWallet _wallet,
        bytes32 _loanId,
        address _debtToken,
        uint256 _debtAmount
    )
        external
        onlyFromMetaTxOrWalletOwner(address(_wallet))
        onlyWhenWalletUnlocked(address(_wallet))
    {
        address dToken = compoundRegistry.getCToken(_debtToken);
        repayBorrow(_wallet, dToken, _debtAmount);
        exitMarketIfNeeded(_wallet, dToken, address(comptroller));
        emit DebtRemoved(address(_wallet), _loanId, _debtToken, _debtAmount);
    }

    /**
     * @dev Gets information about the loan status on Compound.
     * @param _wallet The target wallet.
     * @return a status [0: no loan, 1: loan is safe, 2: loan is unsafe and can be liquidated]
     * and a value (in ETH) representing the value that could still be borrowed when status = 1; or the value of the collateral
     * that should be added to avoid liquidation when status = 2.
     */
    function getLoan(
        BaseWallet _wallet,
        bytes32 /* _loanId */
    )
        external
        view
        returns (uint8 _status, uint256 _ethValue)
    {
        (uint error, uint liquidity, uint shortfall) = comptroller.getAccountLiquidity(address(_wallet));
        require(error == 0, "Compound: failed to get account liquidity");
        if(liquidity > 0) {
            return (1, liquidity);
        }
        if(shortfall > 0) {
            return (2, shortfall);
        }
        return (0,0);
    }

    /* ****************************************** Compound wrappers ******************************************* */

    /**
     * @dev Adds underlying tokens to a cToken contract.
     * @param _wallet The target wallet.
     * @param _cToken The cToken contract.
     * @param _token The underlying token.
     * @param _amount The amount of underlying token to add.
     */
    function mint(BaseWallet _wallet, address _cToken, address _token, uint256 _amount) internal {
        require(_cToken != address(0), "Compound: No market for target token");
        require(_amount > 0, "Compound: amount cannot be 0");
        if(_token == ETH_TOKEN_ADDRESS) {
            _wallet.transact(_cToken, _amount, abi.encodeWithSignature("mint()"));
        }
        else {
            _wallet.transact(_token, 0, abi.encodeWithSignature("approve(address,uint256)", _cToken, _amount));
            _wallet.transact(_cToken, 0, abi.encodeWithSignature("mint(uint256)", _amount));
        }
    }

    /**
     * @dev Redeems underlying tokens from a cToken contract.
     * @param _wallet The target wallet.
     * @param _cToken The cToken contract.
     * @param _amount The amount of cToken to redeem.
     */
    function redeem(BaseWallet _wallet, address _cToken, uint256 _amount) internal {
        require(_cToken != address(0), "Compound: No market for target token");
        require(_amount > 0, "Compound: amount cannot be 0");
        _wallet.transact(_cToken, 0, abi.encodeWithSignature("redeem(uint256)", _amount));
    }

    /**
     * @dev Redeems underlying tokens from a cToken contract.
     * @param _wallet The target wallet.
     * @param _cToken The cToken contract.
     * @param _amount The amount of underlying token to redeem.
     */
    function redeemUnderlying(BaseWallet _wallet, address _cToken, uint256 _amount) internal {
        require(_cToken != address(0), "Compound: No market for target token");
        require(_amount > 0, "Compound: amount cannot be 0");
        _wallet.transact(_cToken, 0, abi.encodeWithSignature("redeemUnderlying(uint256)", _amount));
    }

    /**
     * @dev Borrows underlying tokens from a cToken contract.
     * @param _wallet The target wallet.
     * @param _cToken The cToken contract.
     * @param _amount The amount of underlying tokens to borrow.
     */
    function borrow(BaseWallet _wallet, address _cToken, uint256 _amount) internal {
        require(_cToken != address(0), "Compound: No market for target token");
        require(_amount > 0, "Compound: amount cannot be 0");
        _wallet.transact(_cToken, 0, abi.encodeWithSignature("borrow(uint256)", _amount));
    }

    /**
     * @dev Repays some borrowed underlying tokens to a cToken contract.
     * @param _wallet The target wallet.
     * @param _cToken The cToken contract.
     * @param _amount The amount of underlying to repay.
     */
    function repayBorrow(BaseWallet _wallet, address _cToken, uint256 _amount) internal {
        require(_cToken != address(0), "Compound: No market for target token");
        require(_amount > 0, "Compound: amount cannot be 0");
        string memory symbol = ICToken(_cToken).symbol();
        if(keccak256(abi.encodePacked(symbol)) == keccak256(abi.encodePacked("cETH"))) {
            _wallet.transact(_cToken, _amount, abi.encodeWithSignature("repayBorrow()"));
        }
        else {
            address token = ICToken(_cToken).underlying();
            _wallet.transact(token, 0, abi.encodeWithSignature("approve(address,uint256)", _cToken, _amount));
            _wallet.transact(_cToken, 0, abi.encodeWithSignature("repayBorrow(uint256)", _amount));
        }
    }

    /**
     * @dev Enters a cToken market if it was not entered before.
     * @param _wallet The target wallet.
     * @param _cToken The cToken contract.
     * @param _comptroller The comptroller contract.
     */
    function enterMarketIfNeeded(BaseWallet _wallet, address _cToken, address _comptroller) internal {
        bool isEntered = IComptroller(_comptroller).checkMembership(address(_wallet), ICToken(_cToken));
        if(!isEntered) {
            address[] memory market = new address[](1);
            market[0] = _cToken;
            _wallet.transact(_comptroller, 0, abi.encodeWithSignature("enterMarkets(address[])", market));
        }
    }

    /**
     * @dev Exits a cToken market if there is no more collateral and debt.
     * @param _wallet The target wallet.
     * @param _cToken The cToken contract.
     * @param _comptroller The comptroller contract.
     */
    function exitMarketIfNeeded(BaseWallet _wallet, address _cToken, address _comptroller) internal {
        uint collateral = ICToken(_cToken).balanceOf(address(_wallet));
        uint debt = ICToken(_cToken).borrowBalanceStored(address(_wallet));
        if(collateral == 0 && debt == 0) {
            _wallet.transact(_comptroller, 0, abi.encodeWithSignature("exitMarket(address)", _cToken));
        }
    }
}
