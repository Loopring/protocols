#include "../ThirdParty/catch.hpp"
#include "TestUtils.h"

#include "../Gadgets/MathGadgets.h"

TEST_CASE("SignatureVerifier", "[SignatureVerifier]")
{
     auto signatureVerifierChecked = [](const FieldT& _pubKeyX, const FieldT& _pubKeyY, const FieldT& _msg,
                                        const Loopring::Signature& signature, bool expectedSatisfied, bool checkValid = false)
    {
        for (unsigned int i = 0; i < (checkValid ? 2 : 1); i++)
        {
            bool requireValid = (i == 0);

            protoboard<FieldT> pb;

            Constants constants(pb, "constants");
            jubjub::Params params;
            jubjub::VariablePointT publicKey(pb, "publicKey");
            pb.val(publicKey.x) = _pubKeyX;
            pb.val(publicKey.y) = _pubKeyY;
            pb_variable<FieldT> message = make_variable(pb, _msg, "message");

            SignatureVerifier signatureVerifier(pb, params, constants, publicKey, message, "signatureVerifier", requireValid);
            signatureVerifier.generate_r1cs_constraints();
            signatureVerifier.generate_r1cs_witness(signature);

            REQUIRE(pb.is_satisfied() == (requireValid ? expectedSatisfied : true));
            REQUIRE((pb.val(signatureVerifier.result()) == (expectedSatisfied ? FieldT::one() : FieldT::zero())));
        }
    };

    // Correct publicKey + message + signature
    FieldT pubKeyX = FieldT("21607074953141243618425427250695537464636088817373528162920186615872448542319");
    FieldT pubKeyY = FieldT("3328786100751313619819855397819808730287075038642729822829479432223775713775");
    FieldT msg = FieldT("18996832849579325290301086811580112302791300834635590497072390271656077158490");
    FieldT Rx = FieldT("20401810397006237293387786382094924349489854205086853036638326738826249727385");
    FieldT Ry = FieldT("3339178343289311394427480868578479091766919601142009911922211138735585687725");
    FieldT s = FieldT("219593190015660463654216479865253652653333952251250676996482368461290160677");

    // Different valid public key
    FieldT pubKeyX_2 = FieldT("19818098172422229289422284899436629503222263750727977198150374245991932884258");
    FieldT pubKeyY_2 = FieldT("5951877988471485350710444403782724110196846988892201970720985561004735218817");

    // Signature of message signed by different keypair
    FieldT Rx_2 = FieldT("11724635741659369482608508002194555510423986519388485904857477054244428273528");
    FieldT Ry_2 = FieldT("1141584024686665974825800506178016776173372699473828623261155117285910293572");
    FieldT s_2 = FieldT("48808226556453260593782345205957224790810379817643725430561166968302957481");

    SECTION("All data valid")
    {
        signatureVerifierChecked(pubKeyX, pubKeyY, msg, Loopring::Signature(EdwardsPoint(Rx, Ry), s), true);
    }

    SECTION("All zeros")
    {
        signatureVerifierChecked(0, 0, 0, Loopring::Signature(EdwardsPoint(0, 0), 0), false);
    }

    SECTION("Wrong publicKey.x")
    {
        signatureVerifierChecked(pubKeyX + 1, pubKeyY, msg, Loopring::Signature(EdwardsPoint(Rx, Ry), s), false);
    }

    SECTION("Wrong publicKey.y")
    {
        signatureVerifierChecked(pubKeyX, pubKeyY + 1, msg, Loopring::Signature(EdwardsPoint(Rx, Ry), s), false);
    }

    SECTION("Different (but valid) public key")
    {
        signatureVerifierChecked(pubKeyX_2, pubKeyY_2, msg, Loopring::Signature(EdwardsPoint(Rx, Ry), s), false, true);
    }

    SECTION("Different message")
    {
        signatureVerifierChecked(pubKeyX, pubKeyY, msg + 1, Loopring::Signature(EdwardsPoint(Rx, Ry), s), false, true);
    }

    SECTION("Zero message value")
    {
        signatureVerifierChecked(pubKeyX, pubKeyY, 0, Loopring::Signature(EdwardsPoint(Rx, Ry), s), false);
    }

    SECTION("Max message value")
    {
        signatureVerifierChecked(pubKeyX, pubKeyY, getMaxFieldElement(), Loopring::Signature(EdwardsPoint(Rx, Ry), s), false);
    }

    SECTION("Different Rx")
    {
        signatureVerifierChecked(pubKeyX, pubKeyY, msg, Loopring::Signature(EdwardsPoint(Rx + 1, Ry), s), false);
    }

    SECTION("Different Ry")
    {
        signatureVerifierChecked(pubKeyX, pubKeyY, msg, Loopring::Signature(EdwardsPoint(Rx, Ry + 1), s), false);
    }

    SECTION("Different s")
    {
        signatureVerifierChecked(pubKeyX, pubKeyY, msg, Loopring::Signature(EdwardsPoint(Rx, Ry), s + 1), false);
    }

    SECTION("Signature of message of different public key")
    {
        signatureVerifierChecked(pubKeyX, pubKeyY, msg, Loopring::Signature(EdwardsPoint(Rx_2, Ry_2), s_2), false, true);
    }

    SECTION("Signature invalid but a valid point")
    {
        signatureVerifierChecked(pubKeyX, pubKeyY, msg, Loopring::Signature(EdwardsPoint(pubKeyX, pubKeyY), 0), false, true);
    }
}
