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


/// @title IExchange
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract IExchange
{
    // == Events ==

    event Deposit(
        uint32 depositBlockIdx,
        uint16 slotIdx,
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
    );

    event Withdraw(
        uint24 accountID,
        uint16 tokenID,
        address to,
        uint96 amount
    );

    event WithdrawRequest(
        uint32 withdrawBlockIdx,
        uint16 slotIdx,
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
    );

    event BlockCommitted(
        uint blockIdx,
        bytes32 publicDataHash
    );

    event BlockFinalized(
        uint blockIdx
    );

    event Revert(
        uint blockIdx
    );

    event BlockFeeWithdraw(
        uint32 blockIdx,
        uint amount
    );

    event WithdrawBurned(
        address token,
        uint amount
    );

    event OperatorChanged(
        uint exchangeId,
        address oldOperator,
        address newOperator
    );

    event TokenRegistered(
        address token,
        uint16 tokenId
    );

    // == Public Constants ==

    uint    public constant MAX_NUM_TOKENS = 2 ** 12; // =4096

    uint32  public constant MAX_PROOF_GENERATION_TIME_IN_SECONDS         = 1 hours;

    uint32  public constant MIN_TIME_BLOCK_OPEN                          = 1  minutes;
    uint32  public constant MAX_TIME_BLOCK_OPEN                          = 15 minutes;
    uint32  public constant MIN_TIME_BLOCK_CLOSED_UNTIL_COMMITTABLE      = 2  minutes;

    uint32  public constant MAX_TIME_BLOCK_CLOSED_UNTIL_FORCED           = /*15 minutes*/ 1 days;     // TESTING
    uint32  public constant MAX_TIME_BLOCK_UNTIL_WITHDRAWALMODE          = 1 days;

    uint16  public constant NUM_DEPOSITS_IN_BLOCK                        = 8;
    uint16  public constant NUM_WITHDRAWALS_IN_BLOCK                     = 8;

    uint32  public constant TIMESTAMP_WINDOW_SIZE_IN_SECONDS             = /*1 minutes*/ 1 days;        // TESTING

    // Default account
    uint public constant DEFAULT_ACCOUNT_PUBLICKEY_X = 2760979366321990647384327991146539505488430080750363450053902718557853404165;
    uint public constant DEFAULT_ACCOUNT_PUBLICKEY_Y = 10771439851340068599303586501499035409517957710739943668636844002715618931667;
    uint public constant DEFAULT_ACCOUNT_SECRETKEY   = 531595266505639429282323989096889429445309320547115026296307576144623272935;

    // == Public Variables ==

    uint    public id = 0;
    address public loopringAddress           = address(0);
    address public owner                     = address(0);
    address payable public operator          = address(0);
    address public lrcAddress                = address(0);
    address public exchangeHelperAddress     = address(0);
    address public blockVerifierAddress      = address(0);

    mapping (address => uint16) public tokenToTokenId;
    mapping (uint16 => address) public tokenIdToToken;
    uint16  public numTokensRegistered  = 0;

    uint    public depositFee       = 0;
    uint    public withdrawFee      = 0;
    uint    public maxWithdrawFee   = 0;

    mapping (address => uint) public burnBalances;

    // == Public Functions ==

    function withdrawBurned(
        address token,
        uint amount
        )
        external
        returns (bool success);

    function setFees(
        uint _depositFee,
        uint _withdrawFee
        )
        external;

    function getDepositFee()
        external
        view
        returns (uint);

    function getWithdrawFee()
        external
        view
        returns (uint);

    function commitBlock(
        uint blockType,
        bytes memory data
        )
        public;

    function verifyBlock(
        uint blockIdx,
        uint256[8] calldata proof
        )
        external;

    function revertBlock(
        uint32 blockIdx
        )
        external;

    function createAccount(
        uint publicKeyX,
        uint publicKeyY,
        uint16 tokenID,
        uint96 amount
        )
        public
        payable
        returns (uint24);

    function deposit(
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
        )
        external
        payable;

    function updateAccount(
        uint24 accountID,
        uint publicKeyX,
        uint publicKeyY,
        uint16 tokenID,
        uint96 amount
        )
        public
        payable;

    function requestWithdraw(
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
        )
        external
        payable;

    function withdraw(
        uint blockIdx,
        uint slotIdx
        )
        external;

    function withdrawBlockFee(
        uint32 blockIdx
        )
        external
        returns (bool);

    function getBlockIdx()
        external
        view
        returns (uint);

    function getNumAvailableDepositSlots()
        external
        view
        returns (uint);

    function getNumAvailableWithdrawSlots()
        external
        view
        returns (uint);

    function isInWithdrawMode()
        public
        view
        returns (bool);

    function withdrawFromMerkleTree(
        uint24 accountID,
        uint16 tokenID,
        uint256[24] calldata accountPath,
        uint256[12] calldata balancePath,
        uint32 nonce,
        uint96 balance,
        uint256 tradeHistoryRoot
        )
        external
        returns (bool);

    function withdrawFromPendingDeposit(
        uint depositBlockIdx,
        uint slotIdx
        )
        external
        returns (bool);

    function setOperator(address payable _operator)
        external
        returns (address payable oldOperator);

    function getStake()
        external
        view
        returns (uint);

    function registerToken(
        address token
        )
        public
        returns (uint16 tokenId);

    function getTokenID(
        address tokenAddress
        )
        public
        view
        returns (uint16);

    function getTokenAddress(
        uint16 tokenID
        )
        public
        view
        returns (address);
}
