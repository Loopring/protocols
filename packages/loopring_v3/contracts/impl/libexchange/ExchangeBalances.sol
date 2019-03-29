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

import "../../lib/MathUint.sol";

import "../../thirdparty/MiMC.sol";

import "./ExchangeData.sol";


/// @title IManagingMode.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeBalances
{
    using MathUint  for uint;

    function verifyAccountBalance(
        ExchangeData.State storage S,
        uint256 merkleRoot,
        uint24  accountID,
        uint16  tokenID,
        uint256 pubKeyX,
        uint256 pubKeyY,
        uint32  nonce,
        uint96  balance,
        uint256 tradeHistoryRoot,
        uint256[24] memory accountPath,
        uint256[12] memory balancePath
        )
        public
    {
        // Verify data
        uint256 calculatedRoot = getBalancesRoot(
            tokenID,
            balance,
            tradeHistoryRoot,
            balancePath
        );
        calculatedRoot = getAccountInternalsRoot(
            accountID,
            pubKeyX,
            pubKeyY,
            nonce,
            calculatedRoot,
            accountPath
        );
        require(calculatedRoot == merkleRoot, "INVALID_MERKLE_TREE_DATA");
    }

    function getBalancesRoot(
        uint16 tokenID,
        uint balance,
        uint tradeHistoryRoot,
        uint256[12] memory balancePath
        )
        internal
        pure
        returns (uint256)
    {
        uint256[29] memory IVs;
        fillLevelIVs(IVs);

        uint256[] memory balanceLeafElements = new uint256[](2);
        balanceLeafElements[0] = balance;
        balanceLeafElements[1] = tradeHistoryRoot;
        uint256 balanceItem = MiMC.Hash(balanceLeafElements, 1);

        // Calculate merkle root of balances tree
        uint tokenAddress = tokenID;
        for (uint depth = 0; depth < 12; depth++) {
            if (tokenAddress & 1 == 1) {
                balanceItem = hashImpl(balancePath[depth], balanceItem, IVs[depth]);
            } else {
                balanceItem = hashImpl(balanceItem, balancePath[depth], IVs[depth]);
            }
            tokenAddress = tokenAddress / 2;
        }
        return balanceItem;
    }

    function getAccountInternalsRoot(
        uint24 accountID,
        uint256 pubKeyX,
        uint256 pubKeyY,
        uint nonce,
        uint balancesRoot,
        uint256[24] memory accountPath
        )
        internal
        pure
        returns (uint256)
    {
        uint256[29] memory IVs;
        fillLevelIVs(IVs);

        uint256[] memory accountLeafElements = new uint256[](4);
        accountLeafElements[0] = pubKeyX;
        accountLeafElements[1] = pubKeyY;
        accountLeafElements[2] = nonce;
        accountLeafElements[3] = balancesRoot;
        uint256 accountItem = MiMC.Hash(accountLeafElements, 1);

        uint accountAddress = accountID;
        for (uint depth = 0; depth < 24; depth++) {
            if (accountAddress & 1 == 1) {
                accountItem = hashImpl(accountPath[depth], accountItem, IVs[depth]);
            } else {
                accountItem = hashImpl(accountItem, accountPath[depth], IVs[depth]);
            }
            accountAddress = accountAddress / 2;
        }
        return accountItem;
    }

    function hashImpl (
        uint256 left,
        uint256 right,
        uint256 IV
        )
        internal
        pure
        returns (uint256)
    {
        uint256[] memory x = new uint256[](2);
        x[0] = left;
        x[1] = right;

        return MiMC.Hash(x, IV);
    }

    function fillLevelIVs (
        uint256[29] memory IVs
        )
        internal
        pure
    {
        IVs[0] = 149674538925118052205057075966660054952481571156186698930522557832224430770;
        IVs[1] = 9670701465464311903249220692483401938888498641874948577387207195814981706974;
        IVs[2] = 18318710344500308168304415114839554107298291987930233567781901093928276468271;
        IVs[3] = 6597209388525824933845812104623007130464197923269180086306970975123437805179;
        IVs[4] = 21720956803147356712695575768577036859892220417043839172295094119877855004262;
        IVs[5] = 10330261616520855230513677034606076056972336573153777401182178891807369896722;
        IVs[6] = 17466547730316258748333298168566143799241073466140136663575045164199607937939;
        IVs[7] = 18881017304615283094648494495339883533502299318365959655029893746755475886610;
        IVs[8] = 21580915712563378725413940003372103925756594604076607277692074507345076595494;
        IVs[9] = 12316305934357579015754723412431647910012873427291630993042374701002287130550;
        IVs[10] = 18905410889238873726515380969411495891004493295170115920825550288019118582494;
        IVs[11] = 12819107342879320352602391015489840916114959026915005817918724958237245903353;
        IVs[12] = 8245796392944118634696709403074300923517437202166861682117022548371601758802;
        IVs[13] = 16953062784314687781686527153155644849196472783922227794465158787843281909585;
        IVs[14] = 19346880451250915556764413197424554385509847473349107460608536657852472800734;
        IVs[15] = 14486794857958402714787584825989957493343996287314210390323617462452254101347;
        IVs[16] = 11127491343750635061768291849689189917973916562037173191089384809465548650641;
        IVs[17] = 12217916643258751952878742936579902345100885664187835381214622522318889050675;
        IVs[18] = 722025110834410790007814375535296040832778338853544117497481480537806506496;
        IVs[19] = 15115624438829798766134408951193645901537753720219896384705782209102859383951;
        IVs[20] = 11495230981884427516908372448237146604382590904456048258839160861769955046544;
        IVs[21] = 16867999085723044773810250829569850875786210932876177117428755424200948460050;
        IVs[22] = 1884116508014449609846749684134533293456072152192763829918284704109129550542;
        IVs[23] = 14643335163846663204197941112945447472862168442334003800621296569318670799451;
        IVs[24] = 1933387276732345916104540506251808516402995586485132246682941535467305930334;
        IVs[25] = 7286414555941977227951257572976885370489143210539802284740420664558593616067;
        IVs[26] = 16932161189449419608528042274282099409408565503929504242784173714823499212410;
        IVs[27] = 16562533130736679030886586765487416082772837813468081467237161865787494093536;
        IVs[28] = 6037428193077828806710267464232314380014232668931818917272972397574634037180;
    }
}