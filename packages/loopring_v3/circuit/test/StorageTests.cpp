#include "../ThirdParty/catch.hpp"
#include "TestUtils.h"

#include "../Gadgets/StorageGadgets.h"

TEST_CASE("StorageReader", "[StorageReaderGadget]")
{
    auto storageReaderChecked = [](
                                  const StorageLeaf &storageLeaf,
                                  const FieldT &_storageID,
                                  bool _verify,
                                  bool expectedSatisfied,
                                  const FieldT &expectedFilled = FieldT::zero()) {
        protoboard<FieldT> pb;

        VariableT verify = make_variable(pb, _verify ? FieldT::one() : FieldT::zero(), ".verify");

        StorageGadget storage(pb, "storage");
        storage.generate_r1cs_witness(storageLeaf);

        DualVariableGadget storageID(pb, NUM_BITS_STORAGEID, "storageID");
        storageID.generate_r1cs_witness(pb, _storageID);

        Constants constants(pb, "constants");
        StorageReaderGadget storageReaderGadget(pb, constants, storage, storageID, verify, "storageReaderGadget");
        storageReaderGadget.generate_r1cs_witness();
        storageReaderGadget.generate_r1cs_constraints();

        REQUIRE(pb.is_satisfied() == expectedSatisfied);
        if (expectedSatisfied)
        {
            REQUIRE((pb.val(storageReaderGadget.getData()) == expectedFilled));
        }
    };

    unsigned int delta = pow(2, NUM_BITS_STORAGE_ADDRESS);
    unsigned int storageID = rand() % delta;
    FieldT filled = getRandomFieldElement(NUM_BITS_AMOUNT);

    SECTION("storageID == leafStorageID")
    {
        SECTION("Initial state storageID == 0")
        {
            storageReaderChecked({0, 0}, 0, true, true, 0);
        }
        SECTION("Initial state storageID > 0")
        {
            storageReaderChecked({0, 0}, storageID, true, true, 0);
        }
        SECTION("Order filled")
        {
            storageReaderChecked({filled, storageID}, storageID, true, true, filled);
        }
        SECTION("Initial state storageID == delta - 1")
        {
            storageReaderChecked({0, 0}, delta - 1, true, true, 0);
        }
    }

    SECTION("storageID > leafStorageID (trimmed)")
    {
        SECTION("First overwrite")
        {
            storageReaderChecked({0, 0}, delta, true, true, 0);
        }
        SECTION("Previous order not filled")
        {
            storageReaderChecked({0, storageID}, delta + storageID, true, true, 0);
        }
        SECTION("Previous order filled")
        {
            storageReaderChecked({filled, storageID}, delta + storageID, true, true, 0);
        }
        SECTION("Overwrite delta")
        {
            storageReaderChecked({0, 0}, delta + storageID, true, true, 0);
            storageReaderChecked({0, 0}, delta + delta + storageID, true, true);
            storageReaderChecked({0, 0}, delta * 9 + storageID, true, true);
            storageReaderChecked({0, 0}, delta * 99 + storageID, true, true);
            storageReaderChecked({0, 0}, delta * 999 + storageID, true, true);
            storageReaderChecked({0, 0}, delta * 9999 + storageID, true, true);
        }
    }

    SECTION("storageID < leafStorageID (cancelled)")
    {
        SECTION("First rejection")
        {
            storageReaderChecked({0, delta * 2}, 0, true, false);
        }
        SECTION("New order not filled")
        {
            storageReaderChecked({0, delta + storageID}, storageID, true, false);
        }
        SECTION("New order filled")
        {
            storageReaderChecked({filled, delta + storageID}, storageID, true, false);
        }
        SECTION("New order filled (don't validate)")
        {
            storageReaderChecked({filled, delta + storageID}, storageID, false, true);
        }
    }
}

TEST_CASE("Nonce", "[NonceGadget]")
{
    auto nonceChecked =
      [](const StorageLeaf &storageLeaf, const FieldT &_storageID, bool _verify, bool expectedSatisfied) {
          protoboard<FieldT> pb;

          VariableT verify = make_variable(pb, _verify ? FieldT::one() : FieldT::zero(), ".verify");

          StorageGadget storage(pb, "storage");
          storage.generate_r1cs_witness(storageLeaf);

          DualVariableGadget storageID(pb, NUM_BITS_STORAGEID, "storageID");
          storageID.generate_r1cs_witness(pb, _storageID);

          jubjub::Params params;
          Constants constants(pb, "constants");
          NonceGadget nonceGadget(pb, constants, storage, storageID, verify, "nonceGadget");
          nonceGadget.generate_r1cs_witness();
          nonceGadget.generate_r1cs_constraints();

          REQUIRE(pb.is_satisfied() == expectedSatisfied);
          if (expectedSatisfied)
          {
              REQUIRE((pb.val(nonceGadget.getData()) == FieldT::one()));
          }
      };

    unsigned int delta = pow(2, NUM_BITS_STORAGE_ADDRESS);
    unsigned int storageID = rand() % delta;
    FieldT filled = getRandomFieldElement(NUM_BITS_AMOUNT);

    SECTION("storageID == leafStorageID")
    {
        SECTION("Initial state storageID == 0")
        {
            nonceChecked({0, 0}, 0, true, true);
        }
        SECTION("Initial state storageID > 0")
        {
            nonceChecked({0, 0}, storageID, true, true);
        }
        SECTION("Initial state storageID == delta - 1")
        {
            nonceChecked({0, 0}, delta - 1, true, true);
        }
        SECTION("Slot not used")
        {
            nonceChecked({0, storageID}, storageID, true, true);
        }
        SECTION("Slot used")
        {
            nonceChecked({filled, storageID}, storageID, true, false);
        }
        SECTION("Slot not used (don't validate)")
        {
            nonceChecked({0, storageID}, storageID, false, true);
        }
        SECTION("Slot used (don't validate)")
        {
            nonceChecked({filled, storageID}, storageID, false, true);
        }
    }

    SECTION("storageID > leafStorageID (trimmed)")
    {
        SECTION("First overwrite")
        {
            nonceChecked({0, 0}, delta, true, true);
        }
        SECTION("Previous slot unused")
        {
            nonceChecked({0, storageID}, delta + storageID, true, true);
        }
        SECTION("Previous slot used")
        {
            nonceChecked({filled, storageID}, delta + storageID, true, true);
        }
        SECTION("Overwrite")
        {
            nonceChecked({0, 0}, delta + storageID, true, true);
            nonceChecked({0, 0}, delta + delta + storageID, true, true);
            nonceChecked({0, 0}, delta * 9 + storageID, true, true);
            nonceChecked({0, 0}, delta * 99 + storageID, true, true);
            nonceChecked({0, 0}, delta * 999 + storageID, true, true);
            nonceChecked({0, 0}, delta * 9999 + storageID, true, true);
        }
    }

    SECTION("storageID < leafStorageID (cancelled)")
    {
        SECTION("First rejection")
        {
            nonceChecked({0, delta * 2}, 0, true, false);
        }
        SECTION("Slot not filled")
        {
            nonceChecked({0, delta + storageID}, storageID, true, false);
        }
        SECTION("Slot filled")
        {
            nonceChecked({filled, delta + storageID}, storageID, true, false);
        }
        SECTION("Slot filled (don't validate)")
        {
            nonceChecked({filled, delta + storageID}, storageID, false, true);
        }
    }
}
