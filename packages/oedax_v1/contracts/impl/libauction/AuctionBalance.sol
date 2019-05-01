pragma solidity 0.5.7;
pragma experimental ABIEncoderV2;

// import "../../lib/BurnableERC20.sol";
// import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";

import "../../iface/IAuctionData.sol";

/// @title AuctionBidAsk.
/// @author Daniel Wang  - <daniel@loopring.org>
library AuctionBalance
{
    using MathUint for uint;
    using MathUint for uint32;

    function getBalance(
        IAuctionData.State storage s,
        address user
        )
        internal
        view
        returns (
            IAuctionData.Balance memory bidBalance,
            IAuctionData.Balance memory askBalance
        )
    {
        bidBalance = s.balanceMap[user][s.bidToken];
        askBalance = s.balanceMap[user][s.askToken];
    }

    function depositToken(
        IAuctionData.State storage s,
        address user,
        uint    amount,
        bool    isBid
        )
        internal
    {
        require(amount > 0, "zero amount");
        address tokenAddr = isBid ? s.bidToken : s.askToken;
        assert(tokenAddr != address(0x0));

        require(
            s.oedax.transferToken(tokenAddr, user, amount),
            "token transfer failed"
        );
    }
}