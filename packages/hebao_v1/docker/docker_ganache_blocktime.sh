#!/bin/sh

export DOCKER=true

ganache-cli \
    -l 6700000 \
    --hardfork istanbul \
    --host="0.0.0.0" \
    --db=./testdata \
     -b 5 \
    -i=4321 \
    --account="0x7c71142c72a019568cf848ac7b805d21f2e0fd8bc341e8314580de11c6a397bf,100000000000000000000000000"\
    --account="0x4c5496d2745fe9cc2e0aa3e1aad2b66cc792a716decf707ddb3f92bd2d93ad24,100000000000000000000000000"\
    --account="0x04b9e9d7c1385c581bab12600834f4f90c6e19142faae6c2de670bfb4b5a08c4,100000000000000000000000000"\
    --account="0xa99a8d27d06380565d1cf6c71974e7707a81676c4e7cb3dad2c43babbdca2d23,100000000000000000000000000"\
    --account="0x9fda7156489be5244d8edc3b2dafa6976c14c729d54c21fb6fd193fb72c4de0d,100000000000000000000000000"\
    --account="0x2949899bb4312754e11537e1e2eba03c0298608effeab21620e02a3ef68ea58a,100000000000000000000000000"\
    --account="0x86768554c0bdef3a377d2dd180249936db7010a097d472293ae7808536ea45a9,100000000000000000000000000"\
    --account="0x6be54ed053274a3cda0f03aa9f9ddd4cafbb7bd03ceffe8731ed76c0f0be3297,100000000000000000000000000"\
    --account="0x05a94ee2777a19a7e1ed0c58d2d61b857bb9cd712168cd16848163f12eb80e45,100000000000000000000000000"\
    --account="0x324b720be128e8cacb16395deac8b1332d02da4b2577d4cd94cc453302320ea7,100000000000000000000000000"\
    --account="0x25aa7680c43630318fad7ff2aa7ebb6a7aa8d8e599cbbe5b3de25de20dfe4e1b,100000000000000000000000000"\
    --account="0x918f1cc0581f423d55454112a034e12902a71a8d5dcdb798a8781b40534db976,100000000000000000000000000"\
    --account="0x679e3bef96db80e9e293da28ede5503e95babaf85e6bb5afa4f0363591629d89,100000000000000000000000000"\
    --account="0xfeb462cc1a1338c8d2f64eccea5fdff5e8d9900dc78d4577e2db49571b0699b1,100000000000000000000000000"\
    --account="0x2cebf2be8c8542bc9ab08f8bfd6e5cbd77b7ce3ba30d99bea19887ef4b24f08c,100000000000000000000000000"\
    --account="0x22a6da9181720f347e65a0df66ca8cf57e60321f8e1543321c61cdea586212a6,100000000000000000000000000"\
    --account="0x0e41cca4fb0effd4564814ed6c4ba3cccdf47933175574109e247976fa9aead8,100000000000000000000000000"\
    --account="0x1c5d1d8cdd8d9abcf0fa60bfbab86be6b33a42053bc2f9b11f1021b52e7f840c,100000000000000000000000000"\
    --account="0x80fc4b4b75850d8c0958b341bb8eae1f79819a00902d3744aa02eb8c7b9cb190,100000000000000000000000000"\
    --account="0xe650c108f3904da6078339df60b5d5cb325176f0e79080dd6a138cb3d263e1bc,100000000000000000000000000"\
    --account="0x85cab09b0ad47c35acd100f664f7ecbc98ad82a1c63e836723d05d277942e912,100000000000000000000000000"\
    --account="0x923a8a6b3e00af1ea8668c6842b7ecc028c5d40646189557bd5d2a948a44aaad,100000000000000000000000000"\
    --account="0x1fbd4ac17c5eabf5a2d9a27eb659ee5da3cd45de2c798bf81a8bbab92e198236,100000000000000000000000000"\
    --account="0xae6243ecefe50a7237f7740213f23aa87bd989f6ed2f3b52a1382949a1858953,100000000000000000000000000"\
    --account="0xc1db1e05b3fec89b15809f91fc1a061ad475b50da67df548df3aaaed1002561e,100000000000000000000000000"\
    --account="0x9550cc493b2a691d7ebd5f1fcb62a149eb076d4bf22ba57a9bef98c097df97a1,100000000000000000000000000"\
    --account="0x925871d77ddcc56f2561201a4c55c4019843291b2eacd4fc9adae96d7b22f5c8,100000000000000000000000000"\
    --account="0x72f30ea14204d5f097195dd589fc88054410b3b9ae0eca507f63063f2a9917e1,100000000000000000000000000"\
    --account="0x1c2d58c6b1e7e7d6a1138afb4d792ef22f52b2d435fd87ac4962fbca3052cb0e,100000000000000000000000000"\
    --account="0x563a0da4dfbe88aef3d343be7524a65648b35bf0607d4ee2c3aedd4f6830d23a,100000000000000000000000000"\
    --account="0x516444910fadbb8ac2af5d52acd30c34f3520bf8587f29e5055d39c5e4fcbff3,100000000000000000000000000"\
    --account="0xf5f2a3ba2f74c5d895566fbd9445ba0c210b7b8924cb4aed8cc5973c8d0d128b,100000000000000000000000000"\
    --account="0x3eddec4001f23f5d029a6f6acbb4b5677d904b2db8ff89ea24c6ae45d6bf9be6,100000000000000000000000000"\
    --account="0xf89c65e351038e1298483d4d15b6c818df3805fd6a222bf741ff8ec39a0af92a,100000000000000000000000000"\
    --account="0x034d1db40de6d12d604c814fda4da180d0f086671af5eea83f0aa3f66511d21c,100000000000000000000000000"\
    --account="0x7040ba2e737ebe9ce2e0bdf0915e6bee7a791dd4e23b55fcb9001c72f4ef7ea2,100000000000000000000000000"\
    --account="0xcdfe60b27d0c14475abd2ca3e18afd4ff881bad030e5703cdcb57d74e0bf6f6c,100000000000000000000000000"\
    --account="0x024f728fcd2c88d97635bbf4c6f811c8752bb0b438d9d4634d225f9b645a1c4e,100000000000000000000000000"\
    --account="0xf7752d03bbc6aa7be10e8cd572041a59b5db892e0740b87139903c60645fe046,100000000000000000000000000"\
    --account="0xa429313a6b597efdb47c950b5a2b336cfd2ad5c62b6c6af5e43a007f493c14bc,100000000000000000000000000"\
    --account="0x5e84cfc05aee7e0bc2f6c8559f9828fe79ed23bbf9564dc042cdec89f4200748,100000000000000000000000000"\
    --account="0x9e0cde2ab01ec05d71d93e491203cb66e5e62f6a55fe7a28198fef4e8e6d89c3,100000000000000000000000000"\
    --account="0x845e000ea6c6fbe8f3ba726399faeafd531ac186e5a442091e4bcff0f21db37b,100000000000000000000000000"\
    --account="0xee0989a5bcb4fee9dccc5f728b6c1e7dfac5eed73214b741509edd7d0e647fd0,100000000000000000000000000"\
    --account="0x0783fd7d502d70894edfe6b519495285edf6ebecee90278056ac04120e596535,100000000000000000000000000"\
    --account="0xcd1f81bdb6e47a6b8854e3f54455257cfb06a8d2c8d3cb7338bca7907f937367,100000000000000000000000000"\
    --account="0x03f86ff7366dc323672c7d22b9aca83fd6e1a981fabfe7938a8345240772a4fc,100000000000000000000000000"\
    --account="0xc89e22bb514b880c77eb04b6355a977e12ab6e24b77bfdc4390d21c5d2296325,100000000000000000000000000"\
    --account="0xb6363ec295018ed93759777139049dbb098734843c311ebb9951c1e93feffcb4,100000000000000000000000000"\
    --account="0x3c3cb9b2fcab41e588d5aa0066928f855f2cf09e5c817fc41350eae9cfe8dc36,100000000000000000000000000"\
    --account="0xb7f81428f1f3376ee6a1376fb04fe11f04ddd891004947673fb663a271fb0b63,100000000000000000000000000"\
    --account="0xd96353b2307e5e1b5a55546d2dd7d1f3ce49412d3934423f060da2166fdfd46a,100000000000000000000000000"\
    --account="0xc7c2d4093d5caa9a7fbbe2028c20ac6ae6f575f1f0117f67decc51cca1955d87,100000000000000000000000000"\
    --account="0x549401e385b502cfbbf98562df1d5f41f62c983213966e46e803ca1466fd4e68,100000000000000000000000000"\
    --account="0xa5c5e4f3b71356997b62b3bcfeec2f0eca3a97eac9f774ca3e06fe06258784c8,100000000000000000000000000"\
    --account="0x288f7705eeb5b268b8212f7f1e779e8e0654a2049bd28e67acbb5e84cb7c3e81,100000000000000000000000000"\
    --account="0x26864b3fee0c9804bc933b8aaf321266096ccae0f7ec5a8a81fc6c54d71afc93,100000000000000000000000000"\
    --account="0xc6e7b598408fa2106a33a140d56e3a911e37e568572b40282c1e5f61cb77439b,100000000000000000000000000"\
    --account="0xbe041cfc8a4821b3ae27e5b9f3fab73b8cdf10d69ee81247939e073c99a6d21c,100000000000000000000000000"\
    --account="0x33cebe49ef60870366a26f6d02c1048afa839bee474808049b2be24871e8af45,100000000000000000000000000"\
    --account="0xd69cbcd6aee29c73d8b90dc511506c6c56bfc4c834d65a896d6b23b0c090219e,100000000000000000000000000"\
    --account="0x5c8ed7847fdddd6353b17bdd17c5882721737e2851760f1b27dddd8b5249789b,100000000000000000000000000"\
    --account="0x801e2e92ea83c2b6ece6a134bb3a136904ae0c52c4a172af4d2bb514ec8c0ec7,100000000000000000000000000"\
    --account="0xfc33ae1afd12656e73bf5a8f80921eee4f5718aa4305723f3f24684d6b7a5396,100000000000000000000000000"\
    --account="0x18e9bfca9888aa4cc84f615738e1312df56cf5fd3fb1dabab79d022dafd691d3,100000000000000000000000000"\
    --account="0x9d5f77452b5155ebc58f45817e7bfffcc0d5677d06025cc742243f0fef37d605,100000000000000000000000000"\
    --account="0xe63620d665f1dc235db24cbcfb39d831c5d4aee7792b3c90c1aef57640633bf8,100000000000000000000000000"\
    --account="0xfe0e74ed9a488e4235a9c9f59811dae0b748a35236c55fe9c301bc477753b539,100000000000000000000000000"\
    --account="0x6f93f677854bc8c4ab6fd7b90922cd8780a685420b0cb5d58d5d4de79dcf82aa,100000000000000000000000000"\
    --account="0x11cb4dbfc6cd40c13d4e4ba9931fd2f70fad24982c3d1b7051c5a901a050ce85,100000000000000000000000000"\
    --account="0x036e44468dfadcca7f2950b51c8e2454f91a5c53686638eefb7c4481bdc2a2e1,100000000000000000000000000"\
    --account="0x638c248666fbda3ab04d0171505a84b087af6e416ed0726ef8c100975fe5f939,100000000000000000000000000"\
    --account="0x7f1aa7bf5cc57cee893967820f363450aae1ef6ae9f73ac4b11523a5d95a4904,100000000000000000000000000"\
    --account="0x098fcba4999f5f20458c65123daf6067d8de998d86c1842f564d68fb48196d29,100000000000000000000000000"\
    --account="0x297c6d1f56ff05fcc7273ad3f8f5d8f3230391547e307514bc7af8ad37fd25e7,100000000000000000000000000"\
    --account="0xa92e061a4f54849a94636c290977e08e18afa85d0628468cffb6296c3308be06,100000000000000000000000000"\
    --account="0x49b15f35c5c404402933824288fed4a184954197c9c8005328d4dbc9df0a3adb,100000000000000000000000000"\
    --account="0xa27eb00c2f2963afba2dbff9209e201ac892a22e294a50b881ca7ca645b7e355,100000000000000000000000000"\
    --account="0xfe306053c66bc5f6964fb816187714337c823131ac1a71fff93e4ee0697539a2,100000000000000000000000000"\
    --account="0xa2f44bb030cdc030f2a16a758c1b7f0734cbe4c2f2cb32728a38940c0c84e961,100000000000000000000000000"\
    --account="0x90babfe254ac296d3456160a070e0cd1cb6eacd23381c38be4b71e475b567c2e,100000000000000000000000000"\
    --account="0xfd99499095661fc5863c750114d01060b87fcbcdddacbb32f4584f093f892fdc,100000000000000000000000000"\
    --account="0x409fafa9763d2544a2f22eca592531d8312474c4b8bb7dcd451671bf21f23c2d,100000000000000000000000000"\
    --account="0x3b65e8b804b3bc6424c0dd693ce0498260e67d2e8ab83f48b79e49b4696869ae,100000000000000000000000000"\
    --account="0x3588714b1a0da083ca818e36bf053024036f0470668e25d80834d67759999e34,100000000000000000000000000"\
    --account="0x455e67b7f410cfd90d02907f35dc9aa7a766decef73102c0e85ae0c1c43cfa78,100000000000000000000000000"\
    --account="0xb18efb6f51857d5925e6933c1762c176be235a46cf8d63a3c249f5c23b53d9ef,100000000000000000000000000"\
    --account="0x4e906de36a4ed110ec475c8389821b7c6063fdd5c3ccd36fff1071b6fed58d0b,100000000000000000000000000"\
    --account="0xb6f5de5f70ff0c63dfa1ec1f6e49531467db133cf0e383052e868a4b887fa861,100000000000000000000000000"\
    --account="0x0de00c05be18f10990a9b3e34be7f1c41cf4d53a952b9652df44614fa96d0a3f,100000000000000000000000000"\
    --account="0xeeee2000a3fb3f56b556a126708f85eab194bdb86091d38ef9d746fa6d74d536,100000000000000000000000000"\
    --account="0x90eaacd241b45d4c173d91ce4b67dca73f6fee488264ea87b2b0f8d61e08cfcd,100000000000000000000000000"\
    --account="0x783ed99e6030fa6dd8e1030a11047a530dce88bc2784f2bcdbab485d30b0dc6b,100000000000000000000000000"\
    --account="0x5018ef069f5dcc3df33fc6354c48285a70453839d894fcdc7ca16ba6d834d6e9,100000000000000000000000000"\
    --account="0xc54558c39778f5698c0520d948473c147a84fad7fd3ea0321be6dcf306625065,100000000000000000000000000"\
    --account="0x381fc2a465debf0f2f93629f50cb09069fc6cd8887f8ae6528ceeb05ffddc9fa,100000000000000000000000000"\
    --account="0xfadbe68f9545d2fc7751967d116d03c2d8dd36159dbb3a81947bd14132883905,100000000000000000000000000"\
    --account="0xffbe56884d237652d1cd79c143f03f5776e1d0c419ebcdf3bea4ebd7a15ada00,100000000000000000000000000"\
    --account="0xc75e5900d7a211ac5ae20322baf1dbda1c6995b816d5fe3ddc98baba96e8086d,100000000000000000000000000"\
    --account="0x72e6e319f5dc8cb5b6f5ef6ee55c4008cad7613d9c3aef138b108a6016bb3651,100000000000000000000000000"\
    --acctKeys="ganache_account_keys.txt"
