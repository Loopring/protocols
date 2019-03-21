// This code is taken from ethsnarks

pragma solidity 0.5.2;

import "./MiMC.sol";

library MerkleTree
{
    // ceil(log2(1<<16))
    uint constant public TREE_DEPTH = 12;


    // 1<<16 leaves
    uint constant public MAX_LEAF_COUNT = 2 ** 12;


    struct Data
    {
        uint cur;
        mapping (uint256 => bool) roots;
        uint256[65536][13] leaves;
    }


    function FillLevelIVs (uint256[12] memory IVs)
        internal pure
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
    }


    function HashImpl (uint256 left, uint256 right, uint256 IV)
        internal pure returns (uint256)
    {
        uint256[] memory x = new uint256[](2);
        x[0] = left;
        x[1] = right;

        return MiMC.Hash(x, IV);
    }


    function Insert(Data storage self, uint256 leaf)
        internal returns (uint256, uint256)
    {
        require( leaf != 0 );

        uint256[12] memory IVs;
        FillLevelIVs(IVs);

        uint256 offset = self.cur;

        require (offset != MAX_LEAF_COUNT - 1);

        self.leaves[0][offset] = leaf;

        uint256 new_root = UpdateTree(self, IVs);

        self.cur = offset + 1;

        return (new_root, offset);
    }

    // TODO: FIX THIS
    function Update(Data storage self, uint256 offset, uint256 leaf)
        internal returns (uint256)
    {
        require( leaf != 0 );

        uint256[12] memory IVs;
        FillLevelIVs(IVs);

        require (offset != MAX_LEAF_COUNT - 1);

        self.leaves[0][offset] = leaf;

        uint256 new_root = UpdateTree(self, IVs);

        return new_root;
    }

    function GetLeaf(Data storage self, uint depth, uint offset)
        internal view returns (uint256)
    {
        return GetUniqueLeaf(depth, offset, self.leaves[depth][offset]);
    }

    function GetUniqueLeaf(uint256 depth, uint256 offset, uint256 leaf)
        internal pure returns (uint256)
    {
        if (leaf == 0x0)
        {
            leaf = uint256(
                sha256(
                    abi.encodePacked(
                        uint16(depth),
                        uint240(offset)))) % MiMC.GetScalarField();
        }

        return leaf;
    }

    function UpdateTree(Data storage self, uint256[12] memory IVs)
        internal returns(uint256 root)
    {
        uint CurrentIndex = self.cur;

        uint256 leaf1;

        uint256 leaf2;

        for (uint depth=0; depth < TREE_DEPTH; depth++)
        {
            uint NextIndex = uint(CurrentIndex/2);

            if (CurrentIndex%2 == 0)
            {
                leaf1 = self.leaves[depth][CurrentIndex];

                leaf2 = GetUniqueLeaf(depth, CurrentIndex + 1, self.leaves[depth][CurrentIndex + 1]);
            } else
            {
                leaf1 = GetUniqueLeaf(depth, CurrentIndex - 1, self.leaves[depth][CurrentIndex - 1]);

                leaf2 = self.leaves[depth][CurrentIndex];
            }

            self.leaves[depth+1][NextIndex] = HashImpl(leaf1, leaf2, IVs[depth]);

            CurrentIndex = NextIndex;
        }

        return self.leaves[TREE_DEPTH][0];
    }


    function GetRoot (Data storage self)
        internal view returns(uint256)
    {
        return self.leaves[TREE_DEPTH][0];
    }
}