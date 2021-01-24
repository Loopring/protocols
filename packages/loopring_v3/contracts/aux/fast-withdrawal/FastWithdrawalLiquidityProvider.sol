// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../agents/FastWithdrawalAgent.sol";
import "../../lib/OwnerManagable.sol";
import "../../lib/EIP712.sol";
import "../../lib/ERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/ReentrancyGuard.sol";
import "../../lib/SignatureUtil.sol";


/// @title Basic contract storing funds for a liquidity provider.
/// @author Brecht Devos - <brecht@loopring.org>
contract FastWithdrawalLiquidityProvider is ReentrancyGuard, OwnerManagable
{
    using AddressUtil       for address;
    using AddressUtil       for address payable;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using SignatureUtil     for bytes32;

    struct FastWithdrawalApproval
    {
        address exchange;
        address from;
        address to;
        address token;
        uint96  amount;
        uint32  storageID;
        uint64  validUntil; // most significant 32 bits as block height, least significant 32 bits as block time
        address signer;
        bytes   signature;  // signer's signature
    }

    struct WithdrawalRequest
    {
        address from;
        address to;
        address token;
        uint amount;
        uint timestamp;
    }

    bytes32 constant public FASTWITHDRAWAL_APPROVAL_TYPEHASH = keccak256(
        "FastWithdrawalApproval(address exchange,address from,address to,address token,uint96 amount,uint32 storageID,uint64 validUntil)"
    );

    bytes32 public immutable DOMAIN_SEPARATOR;
    mapping(address => mapping(address => uint)) public userTokenShares;  // token => (account => share)
    mapping(address => mapping(address => uint)) public userTokenBalances;
    mapping(address => uint) public tokenShares;
    uint constant public SHARE_BASE = 10 ** 6;
    uint constant public MAX_AGE_WITHDRAWAL_REQUEST_UNTIL_SHUTDOWN = 15 days; // 15 days
    bool public shutdown = false;

    FastWithdrawalAgent public immutable agent;

    mapping(bytes32 => WithdrawalRequest) public withdrawalRequests;

    event Deposit(address user, address token, uint amount);
    event WithdrawalRequested(address from, address to, address token, uint amount, uint timestamp);
    event WithdrawalRequestProceeded(bytes32 requestHash);
    event LiguidityProviderShudown(address provider, uint timestamp);

    modifier onlyShutdown() {
        require(shutdown, "NOT_SHUTDOWN");
        _;
    }

    modifier onlyNotShutdown() {
        require(!shutdown, "IS_SHUTDOWN");
        _;
    }

    constructor(FastWithdrawalAgent _agent)
    {
        agent = _agent;
        DOMAIN_SEPARATOR = EIP712.hash(EIP712.Domain("FastWithdrawalLiquidityProvider", "1.0", address(this)));
    }

    // Execute the fast withdrawals.
    // Full approvals are posted onchain so they can be used by anyone to speed up the
    // withdrawal by calling , but the approvals are not validated when done by the
    // owner or one of the managers.
    function execute(FastWithdrawalApproval[] calldata approvals)
        external
        nonReentrant
        onlyNotShutdown
    {
        // Prepare the data and validate the approvals when necessary
        FastWithdrawalAgent.Withdrawal[] memory withdrawals =
            new FastWithdrawalAgent.Withdrawal[](approvals.length);

        bool skipApprovalCheck = isManager(msg.sender);
        for (uint i = 0; i < approvals.length; i++) {
            require(skipApprovalCheck || isApprovalValid(approvals[i]), "PROHIBITED");
            withdrawals[i] = translate(approvals[i]);
        }

        // Calculate how much ETH we need to send to the agent contract.
        // We could also send the full ETH balance each time, but that'll need
        // an additional transfer to send funds back, which may actually be more efficient.
        uint value = 0;
        for (uint i = 0; i < withdrawals.length; i++) {
            if (withdrawals[i].token == address(0)) {
                value = value.add(withdrawals[i].amount);
            }
        }
        // Execute all the fast withdrawals
        agent.executeFastWithdrawals{value: value}(withdrawals);
    }

    function deposit(
        address token,
        uint amount
        )
        external
        nonReentrant
    {
        require(amount > 0, "ZERO_AMOUNT");
        uint _balance = 0;
        if (token == address(0)) {
            _balance = address(this).balance;
            address(this).sendETHAndVerify(amount, gasleft()); // ETH
        } else {
            _balance = ERC20(token).balanceOf(address(this));
            token.safeTransferAndVerify(address(this), amount);  // ERC20 token
        }
        userTokenBalances[msg.sender][token] = userTokenBalances[msg.sender][token].add(amount);

        uint _sharesToAdd = 0;
        uint _totalShares = tokenShares[token];
        if (_totalShares == 0) {
            _sharesToAdd = 100 * SHARE_BASE;
        } else {
            _sharesToAdd = _totalShares.mul(amount) / _balance;
        }

        userTokenShares[msg.sender][token] = userTokenShares[msg.sender][token].add(_sharesToAdd);
        tokenShares[token] = _balance.add(_sharesToAdd);
        emit Deposit(msg.sender, token, amount);
    }

    // Allows the LP to transfer funds back out of this contract.
    function requestWithdrawal(
        address to,
        address token,
        uint    amount
        )
        external
        nonReentrant
    {
        require(amount > 0, "ZERO_AMOUNT");
        require(userTokenShares[msg.sender][token] > 0, "NOT_PARTICIPANT");
        WithdrawalRequest memory _request = WithdrawalRequest(msg.sender, to, token, amount, block.timestamp);
        bytes32 _hash = keccak256(
            abi.encodePacked(
                _request.from,
                _request.to,
                _request.token,
                _request.amount,
                _request.timestamp
            )
        );

        require(withdrawalRequests[_hash].from == address(0), "DUPLICATED_REQUEST");
        withdrawalRequests[_hash] = _request;
        emit WithdrawalRequested(
            _request.from,
            _request.to,
            _request.token,
            _request.amount,
            _request.timestamp
        );

    }

    function processWithdrawal(bytes32 requestHash)
        external
        nonReentrant
        onlyManager
    {
        processWithdrawalInternal(requestHash, false);
    }

    function forceWithdraw(bytes32 requestHash)
        external
        nonReentrant
        onlyShutdown
    {
        processWithdrawalInternal(requestHash, true);
    }

    function notifyWithdrawalRequestTooOld(bytes32 requestHash)
        external
        onlyNotShutdown
    {
        WithdrawalRequest memory _request = withdrawalRequests[requestHash];
        require(_request.timestamp > 0, "WITHDRAWAL_REQUEST_NOT_EXIST");
        require(block.timestamp > _request.timestamp + MAX_AGE_WITHDRAWAL_REQUEST_UNTIL_SHUTDOWN,
                "WITHDRAWAL_REQUEST_NOT_TOO_OLD");
        shutdown = true;
        emit LiguidityProviderShudown(address(this), block.timestamp);
    }

    // Allows the LP to enable the necessary ERC20 approvals
    function approve(
        address token,
        address spender,
        uint    amount
        )
        external
        nonReentrant
        onlyOwner
    {
        require(ERC20(token).approve(spender, amount), "APPROVAL_FAILED");
    }

    function isApprovalValid(
        FastWithdrawalApproval calldata approval
        )
        internal
        view
        returns (bool)
    {
        // Compute the hash
        bytes32 hash = EIP712.hashPacked(
            DOMAIN_SEPARATOR,
            keccak256(
                abi.encodePacked(
                    FASTWITHDRAWAL_APPROVAL_TYPEHASH,
                    approval.exchange,
                    approval.from,
                    approval.to,
                    approval.token,
                    approval.amount,
                    approval.storageID,
                    approval.validUntil
                )
            )
        );

        return hash.verifySignature(approval.signer, approval.signature) &&
            checkValidUntil(approval.validUntil) &&
            isManager(approval.signer);
    }

    // receive() payable external {}

    // -- Internal --

    function checkValidUntil(uint64 validUntil)
        internal
        view
        returns (bool)
    {
        return (validUntil & 0xFFFFFFFF) >= block.timestamp ||
            (validUntil >> 32) >= block.number;
    }

    function translate(FastWithdrawalApproval calldata approval)
        internal
        pure
        returns (FastWithdrawalAgent.Withdrawal memory)
    {
        return FastWithdrawalAgent.Withdrawal({
            exchange: approval.exchange,
            from: approval.from,
            to: approval.to,
            token: approval.token,
            amount: approval.amount,
            storageID: approval.storageID
        });
    }

    function processWithdrawalInternal(
        bytes32 requestHash,
        bool forced
        )
        internal
    {
        WithdrawalRequest memory _request = withdrawalRequests[requestHash];
        require(_request.from != address(0), "REQUEST_NOT_EXIST");
        uint _totalBalance = 0;
        address token = _request.token;
        if (token == address(0)) {
            _totalBalance = address(this).balance;
        } else {
            _totalBalance = ERC20(token).balanceOf(address(this));
        }

        uint _shares = userTokenShares[msg.sender][token];
        uint _userBalance = userTokenBalances[msg.sender][token];
        uint _withdrawable = _totalBalance.mul(_shares) / tokenShares[token];
        if (!forced) {
            require(_withdrawable >= _userBalance, "NOT_READY_FOR_WITHDRAWAL");
        }

        uint _actualAmount = _request.amount > _withdrawable ? _withdrawable : _request.amount;
        uint _sharesToBurn = _shares.mul(_actualAmount) / _withdrawable ;
        userTokenShares[msg.sender][token] = _shares.sub(_sharesToBurn);

        if (_userBalance > _actualAmount) {
            userTokenBalances[msg.sender][token] = _userBalance.sub(_actualAmount);
        } else {
            userTokenBalances[msg.sender][token] = 0;
        }

        if (token == address(0)) {
            _request.to.sendETHAndVerify(_actualAmount, gasleft());   // ETH
        } else {
            token.safeTransferAndVerify(_request.to, _actualAmount);  // ERC20 token
        }

        delete withdrawalRequests[requestHash];

        emit WithdrawalRequestProceeded(requestHash);
    }
}
