#include "../ThirdParty/catch.hpp"
#include "TestUtils.h"

#include "../Gadgets/MathGadgets.h"
#include "../Gadgets/SignatureGadgets.h"

TEST_CASE("SignatureVerifier", "[SignatureVerifier]")
{
    auto signatureVerifierChecked = [](
                                      const FieldT &_pubKeyX,
                                      const FieldT &_pubKeyY,
                                      const FieldT &_msg,
                                      const Loopring::Signature &signature,
                                      bool expectedSatisfied,
                                      bool checkValid = false) {
        for (unsigned int i = 0; i < (checkValid ? 2 : 1); i++)
        {
            bool _requireValid = (i == 0);

            protoboard<FieldT> pb;

            Constants constants(pb, "constants");
            jubjub::Params params;
            jubjub::VariablePointT publicKey(pb, "publicKey");
            pb.val(publicKey.x) = _pubKeyX;
            pb.val(publicKey.y) = _pubKeyY;
            pb_variable<FieldT> message = make_variable(pb, _msg, "message");
            pb_variable<FieldT> requireValid = make_variable(pb, _requireValid ? 1 : 0, "requireValid");

            SignatureVerifier signatureVerifier(
              pb, params, constants, publicKey, message, requireValid, "signatureVerifier");
            signatureVerifier.generate_r1cs_constraints();
            signatureVerifier.generate_r1cs_witness(signature);

            REQUIRE(pb.is_satisfied() == (_requireValid ? expectedSatisfied : true));
            REQUIRE((pb.val(signatureVerifier.result()) == (expectedSatisfied ? FieldT::one() : FieldT::zero())));
        }
    };

    // Correct publicKey + message + signature
    FieldT pubKeyX = FieldT("2160707495314124361842542725069553746463608881737352"
                            "8162920186615872448542319");
    FieldT pubKeyY = FieldT("3328786100751313619819855397819808730287075038642729"
                            "822829479432223775713775");
    FieldT msg = FieldT("18996832849579325290301086811580112302791300834635590497"
                        "072390271656077158490");
    FieldT Rx = FieldT("204018103970062372933877863820949243494898542050868530366"
                       "38326738826249727385");
    FieldT Ry = FieldT("333917834328931139442748086857847909176691960114200991192"
                       "2211138735585687725");
    FieldT s = FieldT("2195931900156604636542164798652536526533339522512506769964"
                      "82368461290160677");

    // Different valid public key
    FieldT pubKeyX_2 = FieldT("19818098172422229289422284899436629503222263750727"
                              "977198150374245991932884258");
    FieldT pubKeyY_2 = FieldT("59518779884714853507104444037827241101968469888922"
                              "01970720985561004735218817");

    // Signature of message signed by different keypair
    FieldT Rx_2 = FieldT("1172463574165936948260850800219455551042398651938848590"
                         "4857477054244428273528");
    FieldT Ry_2 = FieldT("1141584024686665974825800506178016776173372699473828623"
                         "261155117285910293572");
    FieldT s_2 = FieldT("48808226556453260593782345205957224790810379817643725430"
                        "561166968302957481");

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
        signatureVerifierChecked(
          pubKeyX, pubKeyY, getMaxFieldElement(), Loopring::Signature(EdwardsPoint(Rx, Ry), s), false);
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
        signatureVerifierChecked(
          pubKeyX, pubKeyY, msg, Loopring::Signature(EdwardsPoint(Rx_2, Ry_2), s_2), false, true);
    }

    SECTION("Signature invalid but a valid point")
    {
        signatureVerifierChecked(
          pubKeyX, pubKeyY, msg, Loopring::Signature(EdwardsPoint(pubKeyX, pubKeyY), 0), false, true);
    }
}

TEST_CASE("CompressPublicKey", "[CompressPublicKey]")
{
    auto compressPublicKeyChecked = [](const FieldT &_pubKeyX, const FieldT &_pubKeyY, bool checkValid = false) {
        protoboard<FieldT> pb;
        Constants constants(pb, "constants");

        jubjub::Params params;
        jubjub::VariablePointT publicKey(pb, "publicKey");
        pb.val(publicKey.x) = _pubKeyX;
        pb.val(publicKey.y) = _pubKeyY;

        CompressPublicKey compressPublicKey(pb, params, constants, publicKey.x, publicKey.y, "compressPublicKey");
        compressPublicKey.generate_r1cs_constraints();
        compressPublicKey.generate_r1cs_witness();

        REQUIRE(pb.is_satisfied() == checkValid);
    };

    // Valid publicKey 1
    FieldT pubKeyX_1 = FieldT("21607074953141243618425427250695537464636088817373"
                              "528162920186615872448542319");
    FieldT pubKeyY_1 = FieldT("33287861007513136198198553978198087302870750386427"
                              "29822829479432223775713775");
    // Valid publicKey 2
    FieldT pubKeyX_2 = FieldT("19818098172422229289422284899436629503222263750727"
                              "977198150374245991932884258");
    FieldT pubKeyY_2 = FieldT("59518779884714853507104444037827241101968469888922"
                              "01970720985561004735218817");

    SECTION("Valid key")
    {
        compressPublicKeyChecked(pubKeyX_1, pubKeyY_1, true);
        compressPublicKeyChecked(pubKeyX_2, pubKeyY_2, true);
    }

    SECTION("(0,0) should be valid")
    {
        compressPublicKeyChecked(FieldT::zero(), FieldT::zero(), true);
    }

    SECTION("Invalid key")
    {
        compressPublicKeyChecked(pubKeyX_1, pubKeyY_2, false);
        compressPublicKeyChecked(pubKeyX_2, pubKeyY_1, false);
    }
}
