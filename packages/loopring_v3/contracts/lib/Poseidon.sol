// SPDX-License-Identifier: Apache-2.0
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
pragma solidity ^0.6.10;


/// @title Poseidon hash function
///        See: https://eprint.iacr.org/2019/458.pdf
///        Code auto-generated by generate_poseidon_EVM_code.py
/// @author Brecht Devos - <brecht@loopring.org>
library Poseidon
{
    //
    // hash_t5f6p52
    //

    struct HashInputs5
    {
        uint t0;
        uint t1;
        uint t2;
        uint t3;
        uint t4;
    }

    function mix(HashInputs5 memory i, uint q) internal pure
    {
        HashInputs5 memory o;
        o.t0 = mulmod(i.t0, 4977258759536702998522229302103997878600602264560359702680165243908162277980, q);
        o.t0 = addmod(o.t0, mulmod(i.t1, 19167410339349846567561662441069598364702008768579734801591448511131028229281, q), q);
        o.t0 = addmod(o.t0, mulmod(i.t2, 14183033936038168803360723133013092560869148726790180682363054735190196956789, q), q);
        o.t0 = addmod(o.t0, mulmod(i.t3, 9067734253445064890734144122526450279189023719890032859456830213166173619761, q), q);
        o.t0 = addmod(o.t0, mulmod(i.t4, 16378664841697311562845443097199265623838619398287411428110917414833007677155, q), q);
        o.t1 = mulmod(i.t0, 107933704346764130067829474107909495889716688591997879426350582457782826785, q);
        o.t1 = addmod(o.t1, mulmod(i.t1, 17034139127218860091985397764514160131253018178110701196935786874261236172431, q), q);
        o.t1 = addmod(o.t1, mulmod(i.t2, 2799255644797227968811798608332314218966179365168250111693473252876996230317, q), q);
        o.t1 = addmod(o.t1, mulmod(i.t3, 2482058150180648511543788012634934806465808146786082148795902594096349483974, q), q);
        o.t1 = addmod(o.t1, mulmod(i.t4, 16563522740626180338295201738437974404892092704059676533096069531044355099628, q), q);
        o.t2 = mulmod(i.t0, 13596762909635538739079656925495736900379091964739248298531655823337482778123, q);
        o.t2 = addmod(o.t2, mulmod(i.t1, 18985203040268814769637347880759846911264240088034262814847924884273017355969, q), q);
        o.t2 = addmod(o.t2, mulmod(i.t2, 8652975463545710606098548415650457376967119951977109072274595329619335974180, q), q);
        o.t2 = addmod(o.t2, mulmod(i.t3, 970943815872417895015626519859542525373809485973005165410533315057253476903, q), q);
        o.t2 = addmod(o.t2, mulmod(i.t4, 19406667490568134101658669326517700199745817783746545889094238643063688871948, q), q);
        o.t3 = mulmod(i.t0, 2953507793609469112222895633455544691298656192015062835263784675891831794974, q);
        o.t3 = addmod(o.t3, mulmod(i.t1, 19025623051770008118343718096455821045904242602531062247152770448380880817517, q), q);
        o.t3 = addmod(o.t3, mulmod(i.t2, 9077319817220936628089890431129759976815127354480867310384708941479362824016, q), q);
        o.t3 = addmod(o.t3, mulmod(i.t3, 4770370314098695913091200576539533727214143013236894216582648993741910829490, q), q);
        o.t3 = addmod(o.t3, mulmod(i.t4, 4298564056297802123194408918029088169104276109138370115401819933600955259473, q), q);
        o.t4 = mulmod(i.t0, 8336710468787894148066071988103915091676109272951895469087957569358494947747, q);
        o.t4 = addmod(o.t4, mulmod(i.t1, 16205238342129310687768799056463408647672389183328001070715567975181364448609, q), q);
        o.t4 = addmod(o.t4, mulmod(i.t2, 8303849270045876854140023508764676765932043944545416856530551331270859502246, q), q);
        o.t4 = addmod(o.t4, mulmod(i.t3, 20218246699596954048529384569730026273241102596326201163062133863539137060414, q), q);
        o.t4 = addmod(o.t4, mulmod(i.t4, 1712845821388089905746651754894206522004527237615042226559791118162382909269, q), q);
        i.t0 = o.t0;
        i.t1 = o.t1;
        i.t2 = o.t2;
        i.t3 = o.t3;
        i.t4 = o.t4;
    }

    function ark(HashInputs5 memory i, uint q, uint c) internal pure
    {
        HashInputs5 memory o;
        o.t0 = addmod(i.t0, c, q);
        o.t1 = addmod(i.t1, c, q);
        o.t2 = addmod(i.t2, c, q);
        o.t3 = addmod(i.t3, c, q);
        o.t4 = addmod(i.t4, c, q);
        i.t0 = o.t0;
        i.t1 = o.t1;
        i.t2 = o.t2;
        i.t3 = o.t3;
        i.t4 = o.t4;
    }

    function sbox_full(HashInputs5 memory i, uint q) internal pure
    {
        HashInputs5 memory o;
        o.t0 = mulmod(i.t0, i.t0, q);
        o.t0 = mulmod(o.t0, o.t0, q);
        o.t0 = mulmod(i.t0, o.t0, q);
        o.t1 = mulmod(i.t1, i.t1, q);
        o.t1 = mulmod(o.t1, o.t1, q);
        o.t1 = mulmod(i.t1, o.t1, q);
        o.t2 = mulmod(i.t2, i.t2, q);
        o.t2 = mulmod(o.t2, o.t2, q);
        o.t2 = mulmod(i.t2, o.t2, q);
        o.t3 = mulmod(i.t3, i.t3, q);
        o.t3 = mulmod(o.t3, o.t3, q);
        o.t3 = mulmod(i.t3, o.t3, q);
        o.t4 = mulmod(i.t4, i.t4, q);
        o.t4 = mulmod(o.t4, o.t4, q);
        o.t4 = mulmod(i.t4, o.t4, q);
        i.t0 = o.t0;
        i.t1 = o.t1;
        i.t2 = o.t2;
        i.t3 = o.t3;
        i.t4 = o.t4;
    }

    function sbox_partial(HashInputs5 memory i, uint q) internal pure
    {
        HashInputs5 memory o;
        o.t0 = mulmod(i.t0, i.t0, q);
        o.t0 = mulmod(o.t0, o.t0, q);
        o.t0 = mulmod(i.t0, o.t0, q);
        i.t0 = o.t0;
    }

    function hash_t5f6p52(HashInputs5 memory i, uint q) internal pure returns (uint)
    {
        // validate inputs
        require(i.t0 < q, "INVALID_INPUT");
        require(i.t1 < q, "INVALID_INPUT");
        require(i.t2 < q, "INVALID_INPUT");
        require(i.t3 < q, "INVALID_INPUT");
        require(i.t4 < q, "INVALID_INPUT");

        // round 0
        ark(i, q, 14397397413755236225575615486459253198602422701513067526754101844196324375522);
        sbox_full(i, q);
        mix(i, q);
        // round 1
        ark(i, q, 10405129301473404666785234951972711717481302463898292859783056520670200613128);
        sbox_full(i, q);
        mix(i, q);
        // round 2
        ark(i, q, 5179144822360023508491245509308555580251733042407187134628755730783052214509);
        sbox_full(i, q);
        mix(i, q);
        // round 3
        ark(i, q, 9132640374240188374542843306219594180154739721841249568925550236430986592615);
        sbox_partial(i, q);
        mix(i, q);
        // round 4
        ark(i, q, 20360807315276763881209958738450444293273549928693737723235350358403012458514);
        sbox_partial(i, q);
        mix(i, q);
        // round 5
        ark(i, q, 17933600965499023212689924809448543050840131883187652471064418452962948061619);
        sbox_partial(i, q);
        mix(i, q);
        // round 6
        ark(i, q, 3636213416533737411392076250708419981662897009810345015164671602334517041153);
        sbox_partial(i, q);
        mix(i, q);
        // round 7
        ark(i, q, 2008540005368330234524962342006691994500273283000229509835662097352946198608);
        sbox_partial(i, q);
        mix(i, q);
        // round 8
        ark(i, q, 16018407964853379535338740313053768402596521780991140819786560130595652651567);
        sbox_partial(i, q);
        mix(i, q);
        // round 9
        ark(i, q, 20653139667070586705378398435856186172195806027708437373983929336015162186471);
        sbox_partial(i, q);
        mix(i, q);
        // round 10
        ark(i, q, 17887713874711369695406927657694993484804203950786446055999405564652412116765);
        sbox_partial(i, q);
        mix(i, q);
        // round 11
        ark(i, q, 4852706232225925756777361208698488277369799648067343227630786518486608711772);
        sbox_partial(i, q);
        mix(i, q);
        // round 12
        ark(i, q, 8969172011633935669771678412400911310465619639756845342775631896478908389850);
        sbox_partial(i, q);
        mix(i, q);
        // round 13
        ark(i, q, 20570199545627577691240476121888846460936245025392381957866134167601058684375);
        sbox_partial(i, q);
        mix(i, q);
        // round 14
        ark(i, q, 16442329894745639881165035015179028112772410105963688121820543219662832524136);
        sbox_partial(i, q);
        mix(i, q);
        // round 15
        ark(i, q, 20060625627350485876280451423010593928172611031611836167979515653463693899374);
        sbox_partial(i, q);
        mix(i, q);
        // round 16
        ark(i, q, 16637282689940520290130302519163090147511023430395200895953984829546679599107);
        sbox_partial(i, q);
        mix(i, q);
        // round 17
        ark(i, q, 15599196921909732993082127725908821049411366914683565306060493533569088698214);
        sbox_partial(i, q);
        mix(i, q);
        // round 18
        ark(i, q, 16894591341213863947423904025624185991098788054337051624251730868231322135455);
        sbox_partial(i, q);
        mix(i, q);
        // round 19
        ark(i, q, 1197934381747032348421303489683932612752526046745577259575778515005162320212);
        sbox_partial(i, q);
        mix(i, q);
        // round 20
        ark(i, q, 6172482022646932735745595886795230725225293469762393889050804649558459236626);
        sbox_partial(i, q);
        mix(i, q);
        // round 21
        ark(i, q, 21004037394166516054140386756510609698837211370585899203851827276330669555417);
        sbox_partial(i, q);
        mix(i, q);
        // round 22
        ark(i, q, 15262034989144652068456967541137853724140836132717012646544737680069032573006);
        sbox_partial(i, q);
        mix(i, q);
        // round 23
        ark(i, q, 15017690682054366744270630371095785995296470601172793770224691982518041139766);
        sbox_partial(i, q);
        mix(i, q);
        // round 24
        ark(i, q, 15159744167842240513848638419303545693472533086570469712794583342699782519832);
        sbox_partial(i, q);
        mix(i, q);
        // round 25
        ark(i, q, 11178069035565459212220861899558526502477231302924961773582350246646450941231);
        sbox_partial(i, q);
        mix(i, q);
        // round 26
        ark(i, q, 21154888769130549957415912997229564077486639529994598560737238811887296922114);
        sbox_partial(i, q);
        mix(i, q);
        // round 27
        ark(i, q, 20162517328110570500010831422938033120419484532231241180224283481905744633719);
        sbox_partial(i, q);
        mix(i, q);
        // round 28
        ark(i, q, 2777362604871784250419758188173029886707024739806641263170345377816177052018);
        sbox_partial(i, q);
        mix(i, q);
        // round 29
        ark(i, q, 15732290486829619144634131656503993123618032247178179298922551820261215487562);
        sbox_partial(i, q);
        mix(i, q);
        // round 30
        ark(i, q, 6024433414579583476444635447152826813568595303270846875177844482142230009826);
        sbox_partial(i, q);
        mix(i, q);
        // round 31
        ark(i, q, 17677827682004946431939402157761289497221048154630238117709539216286149983245);
        sbox_partial(i, q);
        mix(i, q);
        // round 32
        ark(i, q, 10716307389353583413755237303156291454109852751296156900963208377067748518748);
        sbox_partial(i, q);
        mix(i, q);
        // round 33
        ark(i, q, 14925386988604173087143546225719076187055229908444910452781922028996524347508);
        sbox_partial(i, q);
        mix(i, q);
        // round 34
        ark(i, q, 8940878636401797005293482068100797531020505636124892198091491586778667442523);
        sbox_partial(i, q);
        mix(i, q);
        // round 35
        ark(i, q, 18911747154199663060505302806894425160044925686870165583944475880789706164410);
        sbox_partial(i, q);
        mix(i, q);
        // round 36
        ark(i, q, 8821532432394939099312235292271438180996556457308429936910969094255825456935);
        sbox_partial(i, q);
        mix(i, q);
        // round 37
        ark(i, q, 20632576502437623790366878538516326728436616723089049415538037018093616927643);
        sbox_partial(i, q);
        mix(i, q);
        // round 38
        ark(i, q, 71447649211767888770311304010816315780740050029903404046389165015534756512);
        sbox_partial(i, q);
        mix(i, q);
        // round 39
        ark(i, q, 2781996465394730190470582631099299305677291329609718650018200531245670229393);
        sbox_partial(i, q);
        mix(i, q);
        // round 40
        ark(i, q, 12441376330954323535872906380510501637773629931719508864016287320488688345525);
        sbox_partial(i, q);
        mix(i, q);
        // round 41
        ark(i, q, 2558302139544901035700544058046419714227464650146159803703499681139469546006);
        sbox_partial(i, q);
        mix(i, q);
        // round 42
        ark(i, q, 10087036781939179132584550273563255199577525914374285705149349445480649057058);
        sbox_partial(i, q);
        mix(i, q);
        // round 43
        ark(i, q, 4267692623754666261749551533667592242661271409704769363166965280715887854739);
        sbox_partial(i, q);
        mix(i, q);
        // round 44
        ark(i, q, 4945579503584457514844595640661884835097077318604083061152997449742124905548);
        sbox_partial(i, q);
        mix(i, q);
        // round 45
        ark(i, q, 17742335354489274412669987990603079185096280484072783973732137326144230832311);
        sbox_partial(i, q);
        mix(i, q);
        // round 46
        ark(i, q, 6266270088302506215402996795500854910256503071464802875821837403486057988208);
        sbox_partial(i, q);
        mix(i, q);
        // round 47
        ark(i, q, 2716062168542520412498610856550519519760063668165561277991771577403400784706);
        sbox_partial(i, q);
        mix(i, q);
        // round 48
        ark(i, q, 19118392018538203167410421493487769944462015419023083813301166096764262134232);
        sbox_partial(i, q);
        mix(i, q);
        // round 49
        ark(i, q, 9386595745626044000666050847309903206827901310677406022353307960932745699524);
        sbox_partial(i, q);
        mix(i, q);
        // round 50
        ark(i, q, 9121640807890366356465620448383131419933298563527245687958865317869840082266);
        sbox_partial(i, q);
        mix(i, q);
        // round 51
        ark(i, q, 3078975275808111706229899605611544294904276390490742680006005661017864583210);
        sbox_partial(i, q);
        mix(i, q);
        // round 52
        ark(i, q, 7157404299437167354719786626667769956233708887934477609633504801472827442743);
        sbox_partial(i, q);
        mix(i, q);
        // round 53
        ark(i, q, 14056248655941725362944552761799461694550787028230120190862133165195793034373);
        sbox_partial(i, q);
        mix(i, q);
        // round 54
        ark(i, q, 14124396743304355958915937804966111851843703158171757752158388556919187839849);
        sbox_partial(i, q);
        mix(i, q);
        // round 55
        ark(i, q, 11851254356749068692552943732920045260402277343008629727465773766468466181076);
        sbox_full(i, q);
        mix(i, q);
        // round 56
        ark(i, q, 9799099446406796696742256539758943483211846559715874347178722060519817626047);
        sbox_full(i, q);
        mix(i, q);
        // round 57
        ark(i, q, 10156146186214948683880719664738535455146137901666656566575307300522957959544);
        sbox_full(i, q);
        mix(i, q);

        return i.t0;
    }


    //
    // hash_t7f6p52
    //

    struct HashInputs7
    {
        uint t0;
        uint t1;
        uint t2;
        uint t3;
        uint t4;
        uint t5;
        uint t6;
    }

    function mix(HashInputs7 memory i, uint q) internal pure
    {
        HashInputs7 memory o;
        o.t0 = mulmod(i.t0, 14183033936038168803360723133013092560869148726790180682363054735190196956789, q);
        o.t0 = addmod(o.t0, mulmod(i.t1, 9067734253445064890734144122526450279189023719890032859456830213166173619761, q), q);
        o.t0 = addmod(o.t0, mulmod(i.t2, 16378664841697311562845443097199265623838619398287411428110917414833007677155, q), q);
        o.t0 = addmod(o.t0, mulmod(i.t3, 12968540216479938138647596899147650021419273189336843725176422194136033835172, q), q);
        o.t0 = addmod(o.t0, mulmod(i.t4, 3636162562566338420490575570584278737093584021456168183289112789616069756675, q), q);
        o.t0 = addmod(o.t0, mulmod(i.t5, 8949952361235797771659501126471156178804092479420606597426318793013844305422, q), q);
        o.t0 = addmod(o.t0, mulmod(i.t6, 13586657904816433080148729258697725609063090799921401830545410130405357110367, q), q);
        o.t1 = mulmod(i.t0, 2799255644797227968811798608332314218966179365168250111693473252876996230317, q);
        o.t1 = addmod(o.t1, mulmod(i.t1, 2482058150180648511543788012634934806465808146786082148795902594096349483974, q), q);
        o.t1 = addmod(o.t1, mulmod(i.t2, 16563522740626180338295201738437974404892092704059676533096069531044355099628, q), q);
        o.t1 = addmod(o.t1, mulmod(i.t3, 10468644849657689537028565510142839489302836569811003546969773105463051947124, q), q);
        o.t1 = addmod(o.t1, mulmod(i.t4, 3328913364598498171733622353010907641674136720305714432354138807013088636408, q), q);
        o.t1 = addmod(o.t1, mulmod(i.t5, 8642889650254799419576843603477253661899356105675006557919250564400804756641, q), q);
        o.t1 = addmod(o.t1, mulmod(i.t6, 14300697791556510113764686242794463641010174685800128469053974698256194076125, q), q);
        o.t2 = mulmod(i.t0, 8652975463545710606098548415650457376967119951977109072274595329619335974180, q);
        o.t2 = addmod(o.t2, mulmod(i.t1, 970943815872417895015626519859542525373809485973005165410533315057253476903, q), q);
        o.t2 = addmod(o.t2, mulmod(i.t2, 19406667490568134101658669326517700199745817783746545889094238643063688871948, q), q);
        o.t2 = addmod(o.t2, mulmod(i.t3, 17049854690034965250221386317058877242629221002521630573756355118745574274967, q), q);
        o.t2 = addmod(o.t2, mulmod(i.t4, 4964394613021008685803675656098849539153699842663541444414978877928878266244, q), q);
        o.t2 = addmod(o.t2, mulmod(i.t5, 15474947305445649466370538888925567099067120578851553103424183520405650587995, q), q);
        o.t2 = addmod(o.t2, mulmod(i.t6, 1016119095639665978105768933448186152078842964810837543326777554729232767846, q), q);
        o.t3 = mulmod(i.t0, 9077319817220936628089890431129759976815127354480867310384708941479362824016, q);
        o.t3 = addmod(o.t3, mulmod(i.t1, 4770370314098695913091200576539533727214143013236894216582648993741910829490, q), q);
        o.t3 = addmod(o.t3, mulmod(i.t2, 4298564056297802123194408918029088169104276109138370115401819933600955259473, q), q);
        o.t3 = addmod(o.t3, mulmod(i.t3, 6905514380186323693285869145872115273350947784558995755916362330070690839131, q), q);
        o.t3 = addmod(o.t3, mulmod(i.t4, 4783343257810358393326889022942241108539824540285247795235499223017138301952, q), q);
        o.t3 = addmod(o.t3, mulmod(i.t5, 1420772902128122367335354247676760257656541121773854204774788519230732373317, q), q);
        o.t3 = addmod(o.t3, mulmod(i.t6, 14172871439045259377975734198064051992755748777535789572469924335100006948373, q), q);
        o.t4 = mulmod(i.t0, 8303849270045876854140023508764676765932043944545416856530551331270859502246, q);
        o.t4 = addmod(o.t4, mulmod(i.t1, 20218246699596954048529384569730026273241102596326201163062133863539137060414, q), q);
        o.t4 = addmod(o.t4, mulmod(i.t2, 1712845821388089905746651754894206522004527237615042226559791118162382909269, q), q);
        o.t4 = addmod(o.t4, mulmod(i.t3, 13001155522144542028910638547179410124467185319212645031214919884423841839406, q), q);
        o.t4 = addmod(o.t4, mulmod(i.t4, 16037892369576300958623292723740289861626299352695838577330319504984091062115, q), q);
        o.t4 = addmod(o.t4, mulmod(i.t5, 19189494548480259335554606182055502469831573298885662881571444557262020106898, q), q);
        o.t4 = addmod(o.t4, mulmod(i.t6, 19032687447778391106390582750185144485341165205399984747451318330476859342654, q), q);
        o.t5 = mulmod(i.t0, 13272957914179340594010910867091459756043436017766464331915862093201960540910, q);
        o.t5 = addmod(o.t5, mulmod(i.t1, 9416416589114508529880440146952102328470363729880726115521103179442988482948, q), q);
        o.t5 = addmod(o.t5, mulmod(i.t2, 8035240799672199706102747147502951589635001418759394863664434079699838251138, q), q);
        o.t5 = addmod(o.t5, mulmod(i.t3, 21642389080762222565487157652540372010968704000567605990102641816691459811717, q), q);
        o.t5 = addmod(o.t5, mulmod(i.t4, 20261355950827657195644012399234591122288573679402601053407151083849785332516, q), q);
        o.t5 = addmod(o.t5, mulmod(i.t5, 14514189384576734449268559374569145463190040567900950075547616936149781403109, q), q);
        o.t5 = addmod(o.t5, mulmod(i.t6, 19038036134886073991945204537416211699632292792787812530208911676638479944765, q), q);
        o.t6 = mulmod(i.t0, 15627836782263662543041758927100784213807648787083018234961118439434298020664, q);
        o.t6 = addmod(o.t6, mulmod(i.t1, 5655785191024506056588710805596292231240948371113351452712848652644610823632, q), q);
        o.t6 = addmod(o.t6, mulmod(i.t2, 8265264721707292643644260517162050867559314081394556886644673791575065394002, q), q);
        o.t6 = addmod(o.t6, mulmod(i.t3, 17151144681903609082202835646026478898625761142991787335302962548605510241586, q), q);
        o.t6 = addmod(o.t6, mulmod(i.t4, 18731644709777529787185361516475509623264209648904603914668024590231177708831, q), q);
        o.t6 = addmod(o.t6, mulmod(i.t5, 20697789991623248954020701081488146717484139720322034504511115160686216223641, q), q);
        o.t6 = addmod(o.t6, mulmod(i.t6, 6200020095464686209289974437830528853749866001482481427982839122465470640886, q), q);
        i.t0 = o.t0;
        i.t1 = o.t1;
        i.t2 = o.t2;
        i.t3 = o.t3;
        i.t4 = o.t4;
        i.t5 = o.t5;
        i.t6 = o.t6;
    }

    function ark(HashInputs7 memory i, uint q, uint c) internal pure
    {
        HashInputs7 memory o;
        o.t0 = addmod(i.t0, c, q);
        o.t1 = addmod(i.t1, c, q);
        o.t2 = addmod(i.t2, c, q);
        o.t3 = addmod(i.t3, c, q);
        o.t4 = addmod(i.t4, c, q);
        o.t5 = addmod(i.t5, c, q);
        o.t6 = addmod(i.t6, c, q);
        i.t0 = o.t0;
        i.t1 = o.t1;
        i.t2 = o.t2;
        i.t3 = o.t3;
        i.t4 = o.t4;
        i.t5 = o.t5;
        i.t6 = o.t6;
    }

    function sbox_full(HashInputs7 memory i, uint q) internal pure
    {
        HashInputs7 memory o;
        o.t0 = mulmod(i.t0, i.t0, q);
        o.t0 = mulmod(o.t0, o.t0, q);
        o.t0 = mulmod(i.t0, o.t0, q);
        o.t1 = mulmod(i.t1, i.t1, q);
        o.t1 = mulmod(o.t1, o.t1, q);
        o.t1 = mulmod(i.t1, o.t1, q);
        o.t2 = mulmod(i.t2, i.t2, q);
        o.t2 = mulmod(o.t2, o.t2, q);
        o.t2 = mulmod(i.t2, o.t2, q);
        o.t3 = mulmod(i.t3, i.t3, q);
        o.t3 = mulmod(o.t3, o.t3, q);
        o.t3 = mulmod(i.t3, o.t3, q);
        o.t4 = mulmod(i.t4, i.t4, q);
        o.t4 = mulmod(o.t4, o.t4, q);
        o.t4 = mulmod(i.t4, o.t4, q);
        o.t5 = mulmod(i.t5, i.t5, q);
        o.t5 = mulmod(o.t5, o.t5, q);
        o.t5 = mulmod(i.t5, o.t5, q);
        o.t6 = mulmod(i.t6, i.t6, q);
        o.t6 = mulmod(o.t6, o.t6, q);
        o.t6 = mulmod(i.t6, o.t6, q);
        i.t0 = o.t0;
        i.t1 = o.t1;
        i.t2 = o.t2;
        i.t3 = o.t3;
        i.t4 = o.t4;
        i.t5 = o.t5;
        i.t6 = o.t6;
    }

    function sbox_partial(HashInputs7 memory i, uint q) internal pure
    {
        HashInputs7 memory o;
        o.t0 = mulmod(i.t0, i.t0, q);
        o.t0 = mulmod(o.t0, o.t0, q);
        o.t0 = mulmod(i.t0, o.t0, q);
        i.t0 = o.t0;
    }

    function hash_t7f6p52(HashInputs7 memory i, uint q) internal pure returns (uint)
    {
        // validate inputs
        require(i.t0 < q, "INVALID_INPUT");
        require(i.t1 < q, "INVALID_INPUT");
        require(i.t2 < q, "INVALID_INPUT");
        require(i.t3 < q, "INVALID_INPUT");
        require(i.t4 < q, "INVALID_INPUT");
        require(i.t5 < q, "INVALID_INPUT");
        require(i.t6 < q, "INVALID_INPUT");

        // round 0
        ark(i, q, 14397397413755236225575615486459253198602422701513067526754101844196324375522);
        sbox_full(i, q);
        mix(i, q);
        // round 1
        ark(i, q, 10405129301473404666785234951972711717481302463898292859783056520670200613128);
        sbox_full(i, q);
        mix(i, q);
        // round 2
        ark(i, q, 5179144822360023508491245509308555580251733042407187134628755730783052214509);
        sbox_full(i, q);
        mix(i, q);
        // round 3
        ark(i, q, 9132640374240188374542843306219594180154739721841249568925550236430986592615);
        sbox_partial(i, q);
        mix(i, q);
        // round 4
        ark(i, q, 20360807315276763881209958738450444293273549928693737723235350358403012458514);
        sbox_partial(i, q);
        mix(i, q);
        // round 5
        ark(i, q, 17933600965499023212689924809448543050840131883187652471064418452962948061619);
        sbox_partial(i, q);
        mix(i, q);
        // round 6
        ark(i, q, 3636213416533737411392076250708419981662897009810345015164671602334517041153);
        sbox_partial(i, q);
        mix(i, q);
        // round 7
        ark(i, q, 2008540005368330234524962342006691994500273283000229509835662097352946198608);
        sbox_partial(i, q);
        mix(i, q);
        // round 8
        ark(i, q, 16018407964853379535338740313053768402596521780991140819786560130595652651567);
        sbox_partial(i, q);
        mix(i, q);
        // round 9
        ark(i, q, 20653139667070586705378398435856186172195806027708437373983929336015162186471);
        sbox_partial(i, q);
        mix(i, q);
        // round 10
        ark(i, q, 17887713874711369695406927657694993484804203950786446055999405564652412116765);
        sbox_partial(i, q);
        mix(i, q);
        // round 11
        ark(i, q, 4852706232225925756777361208698488277369799648067343227630786518486608711772);
        sbox_partial(i, q);
        mix(i, q);
        // round 12
        ark(i, q, 8969172011633935669771678412400911310465619639756845342775631896478908389850);
        sbox_partial(i, q);
        mix(i, q);
        // round 13
        ark(i, q, 20570199545627577691240476121888846460936245025392381957866134167601058684375);
        sbox_partial(i, q);
        mix(i, q);
        // round 14
        ark(i, q, 16442329894745639881165035015179028112772410105963688121820543219662832524136);
        sbox_partial(i, q);
        mix(i, q);
        // round 15
        ark(i, q, 20060625627350485876280451423010593928172611031611836167979515653463693899374);
        sbox_partial(i, q);
        mix(i, q);
        // round 16
        ark(i, q, 16637282689940520290130302519163090147511023430395200895953984829546679599107);
        sbox_partial(i, q);
        mix(i, q);
        // round 17
        ark(i, q, 15599196921909732993082127725908821049411366914683565306060493533569088698214);
        sbox_partial(i, q);
        mix(i, q);
        // round 18
        ark(i, q, 16894591341213863947423904025624185991098788054337051624251730868231322135455);
        sbox_partial(i, q);
        mix(i, q);
        // round 19
        ark(i, q, 1197934381747032348421303489683932612752526046745577259575778515005162320212);
        sbox_partial(i, q);
        mix(i, q);
        // round 20
        ark(i, q, 6172482022646932735745595886795230725225293469762393889050804649558459236626);
        sbox_partial(i, q);
        mix(i, q);
        // round 21
        ark(i, q, 21004037394166516054140386756510609698837211370585899203851827276330669555417);
        sbox_partial(i, q);
        mix(i, q);
        // round 22
        ark(i, q, 15262034989144652068456967541137853724140836132717012646544737680069032573006);
        sbox_partial(i, q);
        mix(i, q);
        // round 23
        ark(i, q, 15017690682054366744270630371095785995296470601172793770224691982518041139766);
        sbox_partial(i, q);
        mix(i, q);
        // round 24
        ark(i, q, 15159744167842240513848638419303545693472533086570469712794583342699782519832);
        sbox_partial(i, q);
        mix(i, q);
        // round 25
        ark(i, q, 11178069035565459212220861899558526502477231302924961773582350246646450941231);
        sbox_partial(i, q);
        mix(i, q);
        // round 26
        ark(i, q, 21154888769130549957415912997229564077486639529994598560737238811887296922114);
        sbox_partial(i, q);
        mix(i, q);
        // round 27
        ark(i, q, 20162517328110570500010831422938033120419484532231241180224283481905744633719);
        sbox_partial(i, q);
        mix(i, q);
        // round 28
        ark(i, q, 2777362604871784250419758188173029886707024739806641263170345377816177052018);
        sbox_partial(i, q);
        mix(i, q);
        // round 29
        ark(i, q, 15732290486829619144634131656503993123618032247178179298922551820261215487562);
        sbox_partial(i, q);
        mix(i, q);
        // round 30
        ark(i, q, 6024433414579583476444635447152826813568595303270846875177844482142230009826);
        sbox_partial(i, q);
        mix(i, q);
        // round 31
        ark(i, q, 17677827682004946431939402157761289497221048154630238117709539216286149983245);
        sbox_partial(i, q);
        mix(i, q);
        // round 32
        ark(i, q, 10716307389353583413755237303156291454109852751296156900963208377067748518748);
        sbox_partial(i, q);
        mix(i, q);
        // round 33
        ark(i, q, 14925386988604173087143546225719076187055229908444910452781922028996524347508);
        sbox_partial(i, q);
        mix(i, q);
        // round 34
        ark(i, q, 8940878636401797005293482068100797531020505636124892198091491586778667442523);
        sbox_partial(i, q);
        mix(i, q);
        // round 35
        ark(i, q, 18911747154199663060505302806894425160044925686870165583944475880789706164410);
        sbox_partial(i, q);
        mix(i, q);
        // round 36
        ark(i, q, 8821532432394939099312235292271438180996556457308429936910969094255825456935);
        sbox_partial(i, q);
        mix(i, q);
        // round 37
        ark(i, q, 20632576502437623790366878538516326728436616723089049415538037018093616927643);
        sbox_partial(i, q);
        mix(i, q);
        // round 38
        ark(i, q, 71447649211767888770311304010816315780740050029903404046389165015534756512);
        sbox_partial(i, q);
        mix(i, q);
        // round 39
        ark(i, q, 2781996465394730190470582631099299305677291329609718650018200531245670229393);
        sbox_partial(i, q);
        mix(i, q);
        // round 40
        ark(i, q, 12441376330954323535872906380510501637773629931719508864016287320488688345525);
        sbox_partial(i, q);
        mix(i, q);
        // round 41
        ark(i, q, 2558302139544901035700544058046419714227464650146159803703499681139469546006);
        sbox_partial(i, q);
        mix(i, q);
        // round 42
        ark(i, q, 10087036781939179132584550273563255199577525914374285705149349445480649057058);
        sbox_partial(i, q);
        mix(i, q);
        // round 43
        ark(i, q, 4267692623754666261749551533667592242661271409704769363166965280715887854739);
        sbox_partial(i, q);
        mix(i, q);
        // round 44
        ark(i, q, 4945579503584457514844595640661884835097077318604083061152997449742124905548);
        sbox_partial(i, q);
        mix(i, q);
        // round 45
        ark(i, q, 17742335354489274412669987990603079185096280484072783973732137326144230832311);
        sbox_partial(i, q);
        mix(i, q);
        // round 46
        ark(i, q, 6266270088302506215402996795500854910256503071464802875821837403486057988208);
        sbox_partial(i, q);
        mix(i, q);
        // round 47
        ark(i, q, 2716062168542520412498610856550519519760063668165561277991771577403400784706);
        sbox_partial(i, q);
        mix(i, q);
        // round 48
        ark(i, q, 19118392018538203167410421493487769944462015419023083813301166096764262134232);
        sbox_partial(i, q);
        mix(i, q);
        // round 49
        ark(i, q, 9386595745626044000666050847309903206827901310677406022353307960932745699524);
        sbox_partial(i, q);
        mix(i, q);
        // round 50
        ark(i, q, 9121640807890366356465620448383131419933298563527245687958865317869840082266);
        sbox_partial(i, q);
        mix(i, q);
        // round 51
        ark(i, q, 3078975275808111706229899605611544294904276390490742680006005661017864583210);
        sbox_partial(i, q);
        mix(i, q);
        // round 52
        ark(i, q, 7157404299437167354719786626667769956233708887934477609633504801472827442743);
        sbox_partial(i, q);
        mix(i, q);
        // round 53
        ark(i, q, 14056248655941725362944552761799461694550787028230120190862133165195793034373);
        sbox_partial(i, q);
        mix(i, q);
        // round 54
        ark(i, q, 14124396743304355958915937804966111851843703158171757752158388556919187839849);
        sbox_partial(i, q);
        mix(i, q);
        // round 55
        ark(i, q, 11851254356749068692552943732920045260402277343008629727465773766468466181076);
        sbox_full(i, q);
        mix(i, q);
        // round 56
        ark(i, q, 9799099446406796696742256539758943483211846559715874347178722060519817626047);
        sbox_full(i, q);
        mix(i, q);
        // round 57
        ark(i, q, 10156146186214948683880719664738535455146137901666656566575307300522957959544);
        sbox_full(i, q);
        mix(i, q);

        return i.t0;
    }
}
