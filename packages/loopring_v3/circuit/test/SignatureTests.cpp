#include "../Gadgets/MathGadgets.h"
#include "../Gadgets/SignatureGadgets.h"
#include "../ThirdParty/catch.hpp"
#include "TestUtils.h"

TEST_CASE("SignatureVerifier", "[SignatureVerifier]") {
  auto signatureVerifierChecked = [](const FieldT& _pubKeyX,
                                     const FieldT& _pubKeyY, const FieldT& _msg,
                                     const Loopring::Signature& signature,
                                     bool expectedSatisfied,
                                     bool checkValid = false) {
    for (unsigned int i = 0; i < (checkValid ? 2 : 1); i++) {
      bool _requireValid = (i == 0);

      protoboard<FieldT> pb;

      Constants constants(pb, "constants");
      jubjub::Params params;
      jubjub::VariablePointT publicKey(pb, "publicKey");
      pb.val(publicKey.x) = _pubKeyX;
      pb.val(publicKey.y) = _pubKeyY;
      pb_variable<FieldT> message = make_variable(pb, _msg, "message");
      pb_variable<FieldT> requireValid =
          make_variable(pb, _requireValid ? 1 : 0, "requireValid");

      SignatureVerifier signatureVerifier(pb, params, constants, publicKey,
                                          message, requireValid,
                                          "signatureVerifier");
      signatureVerifier.generate_r1cs_constraints();
      signatureVerifier.generate_r1cs_witness(signature);

      REQUIRE(pb.is_satisfied() == (_requireValid ? expectedSatisfied : true));
      REQUIRE((pb.val(signatureVerifier.result()) ==
               (expectedSatisfied ? FieldT::one() : FieldT::zero())));
    }
  };

  // Correct publicKey + message + signature
  FieldT pubKeyX = FieldT(
      "216070749531412436184254272506955374646360888173735281629201866158724485"
      "42319");
  FieldT pubKeyY = FieldT(
      "332878610075131361981985539781980873028707503864272982282947943222377571"
      "3775");
  FieldT msg = FieldT(
      "189968328495793252903010868115801123027913008346355904970723902716560771"
      "58490");
  FieldT Rx = FieldT(
      "204018103970062372933877863820949243494898542050868530366383267388262497"
      "27385");
  FieldT Ry = FieldT(
      "333917834328931139442748086857847909176691960114200991192221113873558568"
      "7725");
  FieldT s = FieldT(
      "219593190015660463654216479865253652653333952251250676996482368461290160"
      "677");

  // Different valid public key
  FieldT pubKeyX_2 = FieldT(
      "198180981724222292894222848994366295032222637507279771981503742459919328"
      "84258");
  FieldT pubKeyY_2 = FieldT(
      "595187798847148535071044440378272411019684698889220197072098556100473521"
      "8817");

  // Signature of message signed by different keypair
  FieldT Rx_2 = FieldT(
      "117246357416593694826085080021945555104239865193884859048574770542444282"
      "73528");
  FieldT Ry_2 = FieldT(
      "114158402468666597482580050617801677617337269947382862326115511728591029"
      "3572");
  FieldT s_2 = FieldT(
      "488082265564532605937823452059572247908103798176437254305611669683029574"
      "81");

  SECTION("All data valid") {
    signatureVerifierChecked(pubKeyX, pubKeyY, msg,
                             Loopring::Signature(EdwardsPoint(Rx, Ry), s),
                             true);
  }

  SECTION("All zeros") {
    signatureVerifierChecked(0, 0, 0,
                             Loopring::Signature(EdwardsPoint(0, 0), 0), false);
  }

  SECTION("Wrong publicKey.x") {
    signatureVerifierChecked(pubKeyX + 1, pubKeyY, msg,
                             Loopring::Signature(EdwardsPoint(Rx, Ry), s),
                             false);
  }

  SECTION("Wrong publicKey.y") {
    signatureVerifierChecked(pubKeyX, pubKeyY + 1, msg,
                             Loopring::Signature(EdwardsPoint(Rx, Ry), s),
                             false);
  }

  SECTION("Different (but valid) public key") {
    signatureVerifierChecked(pubKeyX_2, pubKeyY_2, msg,
                             Loopring::Signature(EdwardsPoint(Rx, Ry), s),
                             false, true);
  }

  SECTION("Different message") {
    signatureVerifierChecked(pubKeyX, pubKeyY, msg + 1,
                             Loopring::Signature(EdwardsPoint(Rx, Ry), s),
                             false, true);
  }

  SECTION("Zero message value") {
    signatureVerifierChecked(pubKeyX, pubKeyY, 0,
                             Loopring::Signature(EdwardsPoint(Rx, Ry), s),
                             false);
  }

  SECTION("Max message value") {
    signatureVerifierChecked(pubKeyX, pubKeyY, getMaxFieldElement(),
                             Loopring::Signature(EdwardsPoint(Rx, Ry), s),
                             false);
  }

  SECTION("Different Rx") {
    signatureVerifierChecked(pubKeyX, pubKeyY, msg,
                             Loopring::Signature(EdwardsPoint(Rx + 1, Ry), s),
                             false);
  }

  SECTION("Different Ry") {
    signatureVerifierChecked(pubKeyX, pubKeyY, msg,
                             Loopring::Signature(EdwardsPoint(Rx, Ry + 1), s),
                             false);
  }

  SECTION("Different s") {
    signatureVerifierChecked(pubKeyX, pubKeyY, msg,
                             Loopring::Signature(EdwardsPoint(Rx, Ry), s + 1),
                             false);
  }

  SECTION("Signature of message of different public key") {
    signatureVerifierChecked(pubKeyX, pubKeyY, msg,
                             Loopring::Signature(EdwardsPoint(Rx_2, Ry_2), s_2),
                             false, true);
  }

  SECTION("Signature invalid but a valid point") {
    signatureVerifierChecked(
        pubKeyX, pubKeyY, msg,
        Loopring::Signature(EdwardsPoint(pubKeyX, pubKeyY), 0), false, true);
  }
}

TEST_CASE("CompressPublicKey", "[CompressPublicKey]") {
  auto compressPublicKeyChecked = [](const FieldT& _pubKeyX,
                                     const FieldT& _pubKeyY,
                                     bool checkValid = false) {
    protoboard<FieldT> pb;
    Constants constants(pb, "constants");

    jubjub::Params params;
    jubjub::VariablePointT publicKey(pb, "publicKey");
    pb.val(publicKey.x) = _pubKeyX;
    pb.val(publicKey.y) = _pubKeyY;

    CompressPublicKey compressPublicKey(pb, params, constants, publicKey.x,
                                        publicKey.y, "compressPublicKey");
    compressPublicKey.generate_r1cs_constraints();
    compressPublicKey.generate_r1cs_witness();

    REQUIRE(pb.is_satisfied() == checkValid);
  };

  // Valid publicKey 1
  FieldT pubKeyX_1 = FieldT(
      "216070749531412436184254272506955374646360888173735281629201866158724485"
      "42319");
  FieldT pubKeyY_1 = FieldT(
      "332878610075131361981985539781980873028707503864272982282947943222377571"
      "3775");
  // Valid publicKey 2
  FieldT pubKeyX_2 = FieldT(
      "198180981724222292894222848994366295032222637507279771981503742459919328"
      "84258");
  FieldT pubKeyY_2 = FieldT(
      "595187798847148535071044440378272411019684698889220197072098556100473521"
      "8817");

  SECTION("Valid key") {
    compressPublicKeyChecked(pubKeyX_1, pubKeyY_1, true);
    compressPublicKeyChecked(pubKeyX_2, pubKeyY_2, true);
  }

  SECTION("(0,0) should be valid") {
    compressPublicKeyChecked(FieldT::zero(), FieldT::zero(), true);
  }

  SECTION("Invalid key") {
    compressPublicKeyChecked(pubKeyX_1, pubKeyY_2, false);
    compressPublicKeyChecked(pubKeyX_2, pubKeyY_1, false);
  }
}
