#include "../ThirdParty/catch.hpp"
#include "TestUtils.h"

#include "../Gadgets/StorageGadgets.h"

TEST_CASE("StorageReader", "[StorageReaderGadget]")
{
    auto storageReaderChecked = [](const StorageLeaf& storageLeaf, const FieldT& _storageID,
                                   bool expectedSatisfied, const FieldT& expectedFilled = FieldT::zero(), const FieldT& expectedOverwrite = FieldT::zero())
    {
        protoboard<FieldT> pb;

        StorageGadget storage(pb, "storage");
        storage.generate_r1cs_witness(storageLeaf);

        DualVariableGadget storageID(pb, NUM_BITS_STORAGEID, "storageID");
        storageID.generate_r1cs_witness(pb, _storageID);

        jubjub::Params params;
        Constants constants(pb, "constants");
        StorageReaderGadget storageReaderGadget(
            pb, constants, storage, storageID, "storageReaderGadget"
        );
        storageReaderGadget.generate_r1cs_witness();
        storageReaderGadget.generate_r1cs_constraints();

        REQUIRE(pb.is_satisfied() == expectedSatisfied);
        if (expectedSatisfied)
        {
            REQUIRE((pb.val(storageReaderGadget.getData()) == expectedFilled));
            REQUIRE((pb.val(storageReaderGadget.getOverwrite()) == expectedOverwrite));
        }
    };

    unsigned int delta = pow(2, NUM_BITS_STORAGE_ADDRESS);
    unsigned int storageID = rand() % delta;
    FieldT filled = getRandomFieldElement(NUM_BITS_AMOUNT);

    SECTION("storageID == leafStorageID")
    {
        SECTION("Initial state storageID == 0")
        {
            storageReaderChecked({0, 0}, 0,
                                 true, 0, 0);
        }
        SECTION("Initial state storageID > 0")
        {
            storageReaderChecked({0, 0}, storageID,
                                 true, 0, 0);
        }
        SECTION("Order filled")
        {
            storageReaderChecked({filled, storageID}, storageID,
                                 true, filled, 0);
        }
        SECTION("Initial state storageID == delta - 1")
        {
            storageReaderChecked({0, 0}, delta - 1,
                                 true, 0, 0);
        }
    }

    SECTION("storageID > leafStorageID (trimmed)")
    {
        SECTION("First overwrite")
        {
            storageReaderChecked({0, 0}, delta,
                                 true, 0, 1);
        }
        SECTION("Previous order not filled")
        {
            storageReaderChecked({0, storageID}, delta + storageID,
                                 true, 0, 1);
        }
        SECTION("Previous order filled")
        {
            storageReaderChecked({filled, storageID}, delta + storageID,
                                 true, 0, 1);
        }
        SECTION("Max overwrite delta")
        {
            storageReaderChecked({0, 0}, delta + storageID,
                                 true, 0, 1);
        }
        SECTION("storageID too big")
        {
            storageReaderChecked({0, 0}, delta + delta + storageID,
                                 false);
            storageReaderChecked({0, 0}, delta * 9 + storageID,
                                 false);
            storageReaderChecked({0, 0}, delta * 99 + storageID,
                                 false);
            storageReaderChecked({0, 0}, delta * 999 + storageID,
                                 false);
            storageReaderChecked({0, 0}, delta * 9999 + storageID,
                                 false);
        }
    }

    SECTION("storageID < leafStorageID (cancelled)")
    {
        SECTION("First rejection")
        {
            storageReaderChecked({0, 0}, delta * 2,
                                 false);
        }
        SECTION("New order not filled")
        {
            storageReaderChecked({0, delta + storageID}, storageID,
                                 false);
        }
        SECTION("New order filled")
        {
            storageReaderChecked({filled, delta + storageID}, storageID,
                                 false);
        }
    }
}
