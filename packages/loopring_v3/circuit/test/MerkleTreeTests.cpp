#include "../ThirdParty/catch.hpp"
#include "TestUtils.h"

#include "../Gadgets/TradingHistoryGadgets.h"
#include "../Gadgets/AccountGadgets.h"

AccountState createAccountState(ProtoboardT& pb, const Account& state)
{
    AccountState accountState;
    accountState.publicKeyX = make_variable(pb, state.publicKey.x, ".publicKeyX");
    accountState.publicKeyY = make_variable(pb, state.publicKey.y, ".publicKeyY");
    accountState.nonce = make_variable(pb, state.nonce, ".nonce");
    accountState.balancesRoot = make_variable(pb, state.balancesRoot, ".balancesRoot");
    return accountState;
}

BalanceState createBalanceState(ProtoboardT& pb, const BalanceLeaf& state)
{
    BalanceState balanceState;
    balanceState.balance = make_variable(pb, state.balance, ".balance");
    balanceState.tradingHistory = make_variable(pb, state.tradingHistoryRoot, ".tradingHistory");
    return balanceState;
}

TradeHistoryState createTradeHistoryState(ProtoboardT& pb, const TradeHistoryLeaf& state)
{
    TradeHistoryState tradeHistoryState;
    tradeHistoryState.filled = make_variable(pb, state.filled, ".filled");
    tradeHistoryState.orderID = make_variable(pb, state.orderID, ".orderID");
    return tradeHistoryState;
}

TEST_CASE("UpdateAccount", "[UpdateAccountGadget]")
{
    RingSettlementBlock block = getRingSettlementBlock();
    REQUIRE(block.ringSettlements.size() > 0);
    const RingSettlement& ringSettlement = block.ringSettlements[0];
    const AccountUpdate& accountUpdate = ringSettlement.accountUpdate_B;

    auto updateAccountChecked = [](const AccountUpdate& accountUpdate, bool expectedSatisfied, bool expectedRootAfterCorrect = true)
    {
        protoboard<FieldT> pb;

        pb_variable<FieldT> rootBefore = make_variable(pb, "rootBefore");
        VariableArrayT address = make_var_array(pb, NUM_BITS_ACCOUNT, ".address");
        AccountState stateBefore = createAccountState(pb, accountUpdate.before);
        AccountState stateAfter = createAccountState(pb, accountUpdate.after);
        address.fill_with_bits_of_field_element(pb, accountUpdate.accountID);
        pb.val(rootBefore) = accountUpdate.rootBefore;

        UpdateAccountGadget updateAccount(pb, rootBefore, address, stateBefore, stateAfter, "updateAccount");
        updateAccount.generate_r1cs_constraints();
        updateAccount.generate_r1cs_witness(accountUpdate.proof);

        REQUIRE(pb.is_satisfied() == expectedSatisfied);
        if (expectedSatisfied)
        {
            REQUIRE((pb.val(updateAccount.result()) == accountUpdate.rootAfter) == expectedRootAfterCorrect);
        }
    };

    SECTION("Everything correct")
    {
        updateAccountChecked(accountUpdate, true, true);
    }

    SECTION("Incorrect address")
    {
        AccountUpdate modifiedAccountUpdate = accountUpdate;
        modifiedAccountUpdate.accountID -= 1;
        updateAccountChecked(modifiedAccountUpdate, false);
    }

    SECTION("Incorrect leaf before")
    {
        AccountUpdate modifiedAccountUpdate = accountUpdate;
        modifiedAccountUpdate.before.nonce += 1;
        updateAccountChecked(modifiedAccountUpdate, false);
    }

    SECTION("Different leaf after")
    {
        AccountUpdate modifiedAccountUpdate = accountUpdate;
        modifiedAccountUpdate.after.nonce += 1;
        updateAccountChecked(modifiedAccountUpdate, true, false);
    }

    SECTION("Incorrect proof")
    {
        AccountUpdate modifiedAccountUpdate = accountUpdate;
        unsigned int randomIndex = rand() % modifiedAccountUpdate.proof.data.size();
        modifiedAccountUpdate.proof.data[randomIndex] += 1;
        updateAccountChecked(modifiedAccountUpdate, false);
    }
}

TEST_CASE("UpdateBalance", "[UpdateBalanceGadget]")
{
    RingSettlementBlock block = getRingSettlementBlock();
    REQUIRE(block.ringSettlements.size() > 0);
    const RingSettlement& ringSettlement = block.ringSettlements[0];
    const BalanceUpdate& balanceUpdate = ringSettlement.balanceUpdateB_B;

    auto updateBalanceChecked = [](const BalanceUpdate& balanceUpdate, bool expectedSatisfied, bool expectedRootAfterCorrect = true)
    {
        protoboard<FieldT> pb;

        pb_variable<FieldT> rootBefore = make_variable(pb, "rootBefore");
        VariableArrayT address = make_var_array(pb, NUM_BITS_TOKEN, ".address");
        BalanceState stateBefore = createBalanceState(pb, balanceUpdate.before);
        BalanceState stateAfter = createBalanceState(pb, balanceUpdate.after);
        address.fill_with_bits_of_field_element(pb, balanceUpdate.tokenID);
        pb.val(rootBefore) = balanceUpdate.rootBefore;

        UpdateBalanceGadget updateBalance(pb, rootBefore, address, stateBefore, stateAfter, "updateBalance");
        updateBalance.generate_r1cs_constraints();
        updateBalance.generate_r1cs_witness(balanceUpdate.proof);

        REQUIRE(pb.is_satisfied() == expectedSatisfied);
        if (expectedSatisfied)
        {
            REQUIRE((pb.val(updateBalance.result()) == balanceUpdate.rootAfter) == expectedRootAfterCorrect);
        }
    };

    SECTION("Everything correct")
    {
        updateBalanceChecked(balanceUpdate, true, true);
    }

    SECTION("Incorrect address")
    {
        BalanceUpdate modifiedBalanceUpdate = balanceUpdate;
        modifiedBalanceUpdate.tokenID += 1;
        updateBalanceChecked(modifiedBalanceUpdate, true, false);
    }

    SECTION("Incorrect leaf before")
    {
        BalanceUpdate modifiedBalanceUpdate = balanceUpdate;
        modifiedBalanceUpdate.before.balance += 1;
        updateBalanceChecked(modifiedBalanceUpdate, false);
    }

    SECTION("Different leaf after")
    {
        BalanceUpdate modifiedBalanceUpdate = balanceUpdate;
        modifiedBalanceUpdate.after.balance += 1;
        updateBalanceChecked(modifiedBalanceUpdate, true, false);
    }

    SECTION("Incorrect proof")
    {
        BalanceUpdate modifiedBalanceUpdate = balanceUpdate;
        unsigned int randomIndex = rand() % modifiedBalanceUpdate.proof.data.size();
        modifiedBalanceUpdate.proof.data[randomIndex] += 1;
        updateBalanceChecked(modifiedBalanceUpdate, false);
    }
}

TEST_CASE("UpdateTradeHistory", "[UpdateTradeHistoryGadget]")
{
    RingSettlementBlock block = getRingSettlementBlock();
    REQUIRE(block.ringSettlements.size() > 0);
    const RingSettlement& ringSettlement = block.ringSettlements[0];
    const TradeHistoryUpdate& tradeHistoryUpdate = ringSettlement.tradeHistoryUpdate_A;

    auto updateTradeHistoryChecked = [](const TradeHistoryUpdate& tradeHistoryUpdate, bool expectedSatisfied, bool expectedRootAfterCorrect = true)
    {
        protoboard<FieldT> pb;

        pb_variable<FieldT> rootBefore = make_variable(pb, "rootBefore");
        VariableArrayT address = make_var_array(pb, NUM_BITS_TRADING_HISTORY, ".address");
        TradeHistoryState stateBefore = createTradeHistoryState(pb, tradeHistoryUpdate.before);
        TradeHistoryState stateAfter = createTradeHistoryState(pb, tradeHistoryUpdate.after);
        address.fill_with_bits_of_field_element(pb, tradeHistoryUpdate.orderID);
        pb.val(rootBefore) = tradeHistoryUpdate.rootBefore;

        UpdateTradeHistoryGadget updateTradeHistory(pb, rootBefore, subArray(address, 0, NUM_BITS_TRADING_HISTORY), stateBefore, stateAfter, "updateTradeHistory");
        updateTradeHistory.generate_r1cs_constraints();
        updateTradeHistory.generate_r1cs_witness(tradeHistoryUpdate.proof);

        REQUIRE(pb.is_satisfied() == expectedSatisfied);
        if (expectedSatisfied)
        {
            REQUIRE((pb.val(updateTradeHistory.result()) == tradeHistoryUpdate.rootAfter) == expectedRootAfterCorrect);
        }
    };

    SECTION("Everything correct")
    {
        updateTradeHistoryChecked(tradeHistoryUpdate, true, true);
    }

    SECTION("Incorrect address")
    {
        TradeHistoryUpdate modifiedTradeHistoryUpdate = tradeHistoryUpdate;
        modifiedTradeHistoryUpdate.orderID += 1;
        updateTradeHistoryChecked(modifiedTradeHistoryUpdate, true, false);
    }

    SECTION("Incorrect leaf before")
    {
        TradeHistoryUpdate modifiedTradeHistoryUpdate = tradeHistoryUpdate;
        modifiedTradeHistoryUpdate.before.filled += 1;
        updateTradeHistoryChecked(modifiedTradeHistoryUpdate, false);
    }

    SECTION("Different leaf after")
    {
        TradeHistoryUpdate modifiedTradeHistoryUpdate = tradeHistoryUpdate;
        modifiedTradeHistoryUpdate.after.filled += 1;
        updateTradeHistoryChecked(modifiedTradeHistoryUpdate, true, false);
    }

    SECTION("Incorrect proof")
    {
        TradeHistoryUpdate modifiedTradeHistoryUpdate = tradeHistoryUpdate;
        unsigned int randomIndex = rand() % modifiedTradeHistoryUpdate.proof.data.size();
        modifiedTradeHistoryUpdate.proof.data[randomIndex] += 1;
        updateTradeHistoryChecked(modifiedTradeHistoryUpdate, false);
    }
}
