/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity 0.5.2;

import "../iface/IExchangeHelper.sol";

import "../lib/MathUint.sol";
import "../lib/NoDefaultFunc.sol";

import "../thirdparty/MiMC.sol";


/// @title An Implementation of IExchangeHelper.
/// @author Brecht Devos - <brecht@loopring.org>,
contract ExchangeHelper is IExchangeHelper, NoDefaultFunc
{
    using MathUint for uint;

    uint256[24] private salts; // salts for the account/balance Merkel tree.

    constructor() public {
        salts[0]  = 149674538925118052205057075966660054952481571156186698930522557832224430770;
        salts[1]  = 9670701465464311903249220692483401938888498641874948577387207195814981706974;
        salts[2]  = 18318710344500308168304415114839554107298291987930233567781901093928276468271;
        salts[3]  = 6597209388525824933845812104623007130464197923269180086306970975123437805179;
        salts[4]  = 21720956803147356712695575768577036859892220417043839172295094119877855004262;
        salts[5]  = 10330261616520855230513677034606076056972336573153777401182178891807369896722;
        salts[6]  = 17466547730316258748333298168566143799241073466140136663575045164199607937939;
        salts[7]  = 18881017304615283094648494495339883533502299318365959655029893746755475886610;
        salts[8]  = 21580915712563378725413940003372103925756594604076607277692074507345076595494;
        salts[9]  = 12316305934357579015754723412431647910012873427291630993042374701002287130550;
        salts[10] = 18905410889238873726515380969411495891004493295170115920825550288019118582494;
        salts[11] = 12819107342879320352602391015489840916114959026915005817918724958237245903353;
        salts[12] = 8245796392944118634696709403074300923517437202166861682117022548371601758802;
        salts[13] = 16953062784314687781686527153155644849196472783922227794465158787843281909585;
        salts[14] = 19346880451250915556764413197424554385509847473349107460608536657852472800734;
        salts[15] = 14486794857958402714787584825989957493343996287314210390323617462452254101347;
        salts[16] = 11127491343750635061768291849689189917973916562037173191089384809465548650641;
        salts[17] = 12217916643258751952878742936579902345100885664187835381214622522318889050675;
        salts[18] = 722025110834410790007814375535296040832778338853544117497481480537806506496;
        salts[19] = 15115624438829798766134408951193645901537753720219896384705782209102859383951;
        salts[20] = 11495230981884427516908372448237146604382590904456048258839160861769955046544;
        salts[21] = 16867999085723044773810250829569850875786210932876177117428755424200948460050;
        salts[22] = 1884116508014449609846749684134533293456072152192763829918284704109129550542;
        salts[23] = 14643335163846663204197941112945447472862168442334003800621296569318670799451;
    }

    function verifyAccountBalance(
        uint256 merkleRoot,
        uint24  accountID,
        uint16  tokenID,
        uint256[24] calldata accountPath,
        uint256[12] calldata balancePath,
        uint256 publicKeyX,
        uint256 publicKeyY,
        uint24  walletID,
        uint32  nonce,
        uint96  balance,
        uint256 tradeHistoryRoot
        )
        external
    {
        // Verify data
        uint256 root = getBalanceRoot(
            tokenID,
            balance,
            tradeHistoryRoot,
            balancePath
        );
        root = getAccountRoot(
            accountID,
            publicKeyX,
            publicKeyY,
            walletID,
            nonce,
            root,
            accountPath
        );
        require(root == merkleRoot, "INVALID_MERKLE_TREE_DATA");
    }

    function getBalanceRoot(
        uint16 tokenID,
        uint balance,
        uint tradeHistoryRoot,
        uint256[12] memory balancePath
        )
        internal
        view
        returns (uint256)
    {
        uint256[] memory balanceLeafElements = new uint256[](2);
        balanceLeafElements[0] = balance;
        balanceLeafElements[1] = tradeHistoryRoot;
        uint256 hash = MiMC.Hash(balanceLeafElements, 1);

        // Calculate merkle root of balances tree
        uint tokenAddress = tokenID;
        for (uint depth = 0; depth < 12; depth++) {
            if (tokenAddress & 1 == 1) {
                hash = MiMCHash(balancePath[depth], hash, salts[depth]);
            } else {
                hash = MiMCHash(hash, balancePath[depth], salts[depth]);
            }
            tokenAddress = tokenAddress / 2;
        }
        return hash;
    }

    function getAccountRoot(
        uint24 accountID,
        uint256 publicKeyX,
        uint256 publicKeyY,
        uint24 walletID,
        uint nonce,
        uint balancesRoot,
        uint256[24] memory accountPath
        )
        internal
        view
        returns (uint256)
    {
        uint256[] memory accountLeafElements = new uint256[](5);
        accountLeafElements[0] = publicKeyX;
        accountLeafElements[1] = publicKeyY;
        accountLeafElements[2] = walletID;
        accountLeafElements[3] = nonce;
        accountLeafElements[4] = balancesRoot;

        uint256 hash = MiMC.Hash(accountLeafElements, 1);

        uint accountAddress = accountID;
        for (uint depth = 0; depth < 24; depth++) {
            if (accountAddress & 1 == 1) {
                hash = MiMCHash(accountPath[depth], hash, salts[depth]);
            } else {
                hash = MiMCHash(hash, accountPath[depth], salts[depth]);
            }
            accountAddress = accountAddress / 2;
        }
        return hash;
    }

    function MiMCHash (
        uint256 left,
        uint256 right,
        uint256 salt
        )
        internal
        pure
        returns (uint256)
    {
        uint256[] memory x = new uint256[](2);
        x[0] = left;
        x[1] = right;

        return MiMC.Hash(x, salt);
    }
}
