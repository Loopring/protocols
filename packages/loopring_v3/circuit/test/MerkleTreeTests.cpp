#include "../ThirdParty/catch.hpp"
#include "TestUtils.h"

#include "../Gadgets/StorageGadgets.h"
#include "../Gadgets/AccountGadgets.h"

AccountState createAccountState(ProtoboardT &pb, const AccountLeaf &state)
{
    AccountState accountState;
    accountState.owner = make_variable(pb, state.owner, ".owner");
    accountState.publicKeyX = make_variable(pb, state.publicKey.x, ".publicKeyX");
    accountState.publicKeyY = make_variable(pb, state.publicKey.y, ".publicKeyY");
    accountState.nonce = make_variable(pb, state.nonce, ".nonce");
    accountState.feeBipsAMM = make_variable(pb, state.feeBipsAMM, ".feeBipsAMM");
    accountState.balancesRoot = make_variable(pb, state.balancesRoot, ".balancesRoot");
    return accountState;
}

BalanceState createBalanceState(ProtoboardT &pb, const BalanceLeaf &state)
{
    BalanceState balanceState;
    balanceState.balance = make_variable(pb, state.balance, ".balance");
    balanceState.weightAMM = make_variable(pb, state.weightAMM, ".weightAMM");
    balanceState.storageRoot = make_variable(pb, state.storageRoot, ".storage");
    return balanceState;
}

StorageState createStorageState(ProtoboardT &pb, const StorageLeaf &state)
{
    StorageState storageState;
    storageState.data = make_variable(pb, state.data, ".data");
    storageState.storageID = make_variable(pb, state.storageID, ".storageID");
    return storageState;
}

TEST_CASE("UpdateAccount", "[UpdateAccountGadget]")
{
    Block block = getBlock();
    const UniversalTransaction &tx = getSpotTrade(block);
    const AccountUpdate &accountUpdate = tx.witness.accountUpdate_B;

    auto updateAccountChecked =
      [](const AccountUpdate &accountUpdate, bool expectedSatisfied, bool expectedRootAfterCorrect = true) {
          protoboard<FieldT> pb;

          pb_variable<FieldT> rootBefore = make_variable(pb, "rootBefore");
          VariableArrayT address = make_var_array(pb, NUM_BITS_ACCOUNT, ".address");
          AccountState stateBefore = createAccountState(pb, accountUpdate.before);
          AccountState stateAfter = createAccountState(pb, accountUpdate.after);
          address.fill_with_bits_of_field_element(pb, accountUpdate.accountID);
          pb.val(rootBefore) = accountUpdate.rootBefore;

          UpdateAccountGadget updateAccount(pb, rootBefore, address, stateBefore, stateAfter, "updateAccount");
          updateAccount.generate_r1cs_constraints();
          updateAccount.generate_r1cs_witness(accountUpdate);

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
    Block block = getBlock();
    const UniversalTransaction &tx = getSpotTrade(block);
    const BalanceUpdate &balanceUpdate = tx.witness.balanceUpdateB_B;

    auto updateBalanceChecked =
      [](const BalanceUpdate &balanceUpdate, bool expectedSatisfied, bool expectedRootAfterCorrect = true) {
          protoboard<FieldT> pb;

          pb_variable<FieldT> rootBefore = make_variable(pb, "rootBefore");
          VariableArrayT address = make_var_array(pb, NUM_BITS_TOKEN, ".address");
          BalanceState stateBefore = createBalanceState(pb, balanceUpdate.before);
          BalanceState stateAfter = createBalanceState(pb, balanceUpdate.after);
          address.fill_with_bits_of_field_element(pb, balanceUpdate.tokenID);
          pb.val(rootBefore) = balanceUpdate.rootBefore;

          UpdateBalanceGadget updateBalance(pb, rootBefore, address, stateBefore, stateAfter, "updateBalance");
          updateBalance.generate_r1cs_constraints();
          updateBalance.generate_r1cs_witness(balanceUpdate);

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

TEST_CASE("UpdateStorage", "[UpdateStorageGadget]")
{
    Block block = getBlock();
    const UniversalTransaction &tx = getSpotTrade(block);
    const StorageUpdate &storageUpdate = tx.witness.storageUpdate_A;

    auto updateStorageChecked =
      [](const StorageUpdate &storageUpdate, bool expectedSatisfied, bool expectedRootAfterCorrect = true) {
          protoboard<FieldT> pb;

          pb_variable<FieldT> rootBefore = make_variable(pb, "rootBefore");
          VariableArrayT address = make_var_array(pb, NUM_BITS_STORAGE_ADDRESS, ".address");
          StorageState stateBefore = createStorageState(pb, storageUpdate.before);
          StorageState stateAfter = createStorageState(pb, storageUpdate.after);
          address.fill_with_bits_of_field_element(pb, storageUpdate.storageID);
          pb.val(rootBefore) = storageUpdate.rootBefore;

          UpdateStorageGadget updateStorage(
            pb, rootBefore, subArray(address, 0, NUM_BITS_STORAGE_ADDRESS), stateBefore, stateAfter, "updateStorage");
          updateStorage.generate_r1cs_constraints();
          updateStorage.generate_r1cs_witness(storageUpdate);

          REQUIRE(pb.is_satisfied() == expectedSatisfied);
          if (expectedSatisfied)
          {
              REQUIRE((pb.val(updateStorage.result()) == storageUpdate.rootAfter) == expectedRootAfterCorrect);
          }
      };

    SECTION("Everything correct")
    {
        updateStorageChecked(storageUpdate, true, true);
    }

    SECTION("Incorrect address")
    {
        StorageUpdate modifiedStorageUpdate = storageUpdate;
        modifiedStorageUpdate.storageID += 1;
        updateStorageChecked(modifiedStorageUpdate, true, false);
    }

    SECTION("Incorrect leaf before")
    {
        StorageUpdate modifiedStorageUpdate = storageUpdate;
        modifiedStorageUpdate.before.data += 1;
        updateStorageChecked(modifiedStorageUpdate, false);
    }

    SECTION("Different leaf after")
    {
        StorageUpdate modifiedStorageUpdate = storageUpdate;
        modifiedStorageUpdate.after.data += 1;
        updateStorageChecked(modifiedStorageUpdate, true, false);
    }

    SECTION("Incorrect proof")
    {
        StorageUpdate modifiedStorageUpdate = storageUpdate;
        unsigned int randomIndex = rand() % modifiedStorageUpdate.proof.data.size();
        modifiedStorageUpdate.proof.data[randomIndex] += 1;
        updateStorageChecked(modifiedStorageUpdate, false);
    }
}
