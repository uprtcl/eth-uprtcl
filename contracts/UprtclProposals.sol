pragma solidity >=0.5.0 <0.6.0;
pragma experimental ABIEncoderV2;

import "./UprtclRoot.sol";
import "./SafeMath.sol";
import "./HasSuperUsers.sol";

contract UprtclProposals is HasSuperUsers {

    using SafeMath for uint256;

    struct HeadUpdate {
        bytes32 perspectiveIdHash;
        bytes32 headCid1;
        bytes32 headCid0;
        uint8 executed;
    }

    struct HeadUpdateInput {
        bytes32 perspectiveIdHash;
        bytes32 headCid1;
        bytes32 headCid0;
        string fromPerspectiveId;
        string fromHeadId;
    }

    struct NewProposal {
        string toPerspectiveId;
        string fromPerspectiveId;
        string toHeadId;
        string fromHeadId;
        address owner;
        uint256 nonce;
        HeadUpdateInput[] headUpdates;
        address[] approvedAddresses;
    }

    struct Proposal {
        address owner;
        HeadUpdate[] headUpdates;
        address[] approvedAddresses;
        uint8 status;
        uint8 authorized;
        uint8 rejected;
        uint8 withdrawn;
    }

    struct OwnerFees {
        uint256 fee;
        uint256 balance;
    }

    mapping(bytes32 => Proposal) public proposals;
    mapping(address => OwnerFees) public fees;

    uint256 public minFee;
    uint256 public factor_num;
    uint256 public factor_den;

    UprtclRoot uprtclRoot;

    event ProposalCreated(
        bytes32 indexed toPerspectiveIdHash,
        bytes32 indexed fromPerspectiveIdHash,
        bytes32 indexed proposalId,
        string toPerspectiveId,
        string fromPerspectiveId,
        string toHeadId,
        string fromHeadId,
        uint256 nonce,
        address creator
    );

    event HeadUpdateAdded(
        bytes32 indexed proposalId,
        bytes32 indexed perspectiveIdHash,
        string fromPerspectiveId,
        string fromHeadId
    );

    function setUprtclRoot(UprtclRoot _uprtclRoot) external onlyOwner {
        uprtclRoot = _uprtclRoot;
    }

    function getProposalId(
        string memory toPerspectiveId,
        string memory fromPerspectiveId,
        uint256 nonce
    ) public pure returns (bytes32 proposalId) {
        proposalId = keccak256(
            abi.encodePacked(toPerspectiveId, fromPerspectiveId, nonce)
        );
    }

    function setMinFee(uint256 _minFee) external onlyOwner {
        minFee = _minFee;
    }

    function setFactorNum(uint256 _factor_num) external onlyOwner {
        factor_num = _factor_num;
    }

    function setFactorDen(uint256 _factor_den) external onlyOwner {
        factor_den = _factor_den;
    }

    function initProposal(
        NewProposal memory newProposal,
        address account
    ) public {

        address perspOwner = uprtclRoot.getPerspectiveOwner(
            uprtclRoot.getPerspectiveIdHash(newProposal.toPerspectiveId)
        );
        uint256 perspFee = fees[perspOwner].fee;

        if (perspFee == 0) {
            /** charge only min fee */
            if (minFee > 0) {
                uprtclRoot.consume(account, msg.sender, minFee);
            }
        } else {
            /** charge fee and transfer to perspOwner, keep a fraction to us */
            uint256 feeUprtcl = perspFee.mul(factor_num).div(factor_den);
            uint256 feeOwner = perspFee.mul(factor_den.sub(factor_num)).div(factor_den);

            uint256 feeUprtclActual = feeUprtcl;
            if (feeUprtcl < minFee) {
                feeUprtclActual = minFee;
            }

            uprtclRoot.transferTo(account, msg.sender, perspOwner, feeOwner);
            uprtclRoot.consume(account, msg.sender, feeUprtclActual);
        }

        bytes32 proposalId = getProposalId(
            newProposal.toPerspectiveId,
            newProposal.fromPerspectiveId,
            newProposal.nonce
        );

        /** make sure the proposal does not exist */
        Proposal storage proposal = proposals[proposalId];
        require(proposal.owner == address(0), "proposal already exist");

        proposal.owner = newProposal.owner;
        proposal.approvedAddresses = newProposal.approvedAddresses;
        proposal.status = 1;
        proposal.authorized = 0;
        proposal.rejected = 0;
        proposal.withdrawn = 0;

        addUpdatesToProposal(proposalId, newProposal.headUpdates);

        emit ProposalCreated(
            uprtclRoot.getPerspectiveIdHash(newProposal.toPerspectiveId),
            uprtclRoot.getPerspectiveIdHash(newProposal.fromPerspectiveId),
            proposalId,
            newProposal.toPerspectiveId,
            newProposal.fromPerspectiveId,
            newProposal.toHeadId,
            newProposal.fromHeadId,
            newProposal.nonce,
            msg.sender
        );
    }

    function isApproved(Proposal memory proposal, address value)
        private
        pure
        returns (uint8 approved)
    {
        if (proposal.approvedAddresses.length == 0) {
          approved = 1;
          return approved;
        }

        for (uint32 ix = 0; ix < proposal.approvedAddresses.length; ix++) {
            if (value == proposal.approvedAddresses[ix]) {
                approved = 1;
                return approved;
            }
        }
        approved = 0;
    }

    /** Add one or more headUpdate elements to an existing proposal */
    function addUpdatesToProposal(
        bytes32 proposalId,
        HeadUpdateInput[] memory headUpdates
    ) public {
        Proposal storage proposal = proposals[proposalId];

        /** make sure the proposal is open for new elements */
        require(proposal.owner != address(0), "proposal not found");
        require(proposal.status != 0, "proposal status is disabled");
        require(
            isApproved(proposal, msg.sender) > 0,
            "msg.sender not an approved address"
        );

        for (uint8 ix = 0; ix < headUpdates.length; ix++) {
            HeadUpdateInput memory headUpdateInput = headUpdates[ix];

            require(
                uprtclRoot.getPerspectiveOwner(headUpdateInput.perspectiveIdHash) == proposal.owner,
                "proposal can only store perspectives owned by its owner"
            );

            HeadUpdate memory headUpdate;
            headUpdate.perspectiveIdHash = headUpdateInput.perspectiveIdHash;
            headUpdate.headCid1 = headUpdateInput.headCid1;
            headUpdate.headCid0 = headUpdateInput.headCid0;
            headUpdate.executed = 0;

            proposal.headUpdates.push(headUpdate);

            emit HeadUpdateAdded(
                proposalId,
                headUpdateInput.perspectiveIdHash,
                headUpdateInput.fromPerspectiveId,
                headUpdateInput.fromHeadId        
            );
        }
    }

    function setProposalStatus(bytes32 proposalId, uint8 status) external {
        Proposal storage proposal = proposals[proposalId];
        require(
            isApproved(proposal, msg.sender) > 0,
            "msg.sender not an approved address"
        );
        proposal.status = status;
    }

    function authorizeProposalSuperUser(bytes32 proposalId, uint8 authorized, bool execute, address msgSender) external onlySuperUser {
        setProposalAuthorized(proposalId, authorized, execute, msgSender);
    }

    function authorizeProposal(bytes32 proposalId, uint8 authorized, bool execute) external {
        setProposalAuthorized(proposalId, authorized, execute, msg.sender);
    }

    function setProposalAuthorized(bytes32 proposalId, uint8 authorized, bool execute, address msgSender) private {
        Proposal storage proposal = proposals[proposalId];
        require(
            msgSender == proposal.owner,
            "Proposal can only by authorized by its owner"
        );
        if (authorized > 0) {
            require(proposal.withdrawn == 0, "proposal can't be authorized, it's been withdrawn");
            /** by default the proposal is closed once it is authorized. */
            proposal.status = 0;
        }
        proposal.authorized = authorized;

        if (execute) {
            executeProposalInternal(proposalId, msgSender);
        }
    }

    function rejectProposal(bytes32 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(
            msg.sender == proposal.owner,
            "Proposal can only by rejected by its owner"
        );
        require(proposal.authorized == 0, "proposal can't be rejected, it's already authorized");
        /** once rejected, a proposal cant be executed */
        proposal.rejected = 1;
    }

    function withdrawProposal(bytes32 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(
            msg.sender == proposal.owner,
            "Proposal can only by rejected by its owner"
        );
        require(proposal.authorized == 0, "proposal can't be withdrawn, it's already authorized");

        /** once withdrawn, a proposal cant be authorized */
        proposal.withdrawn = 1;
    }


    function executeProposalInternal(bytes32 proposalId, address msgSender) private {
        Proposal storage proposal = proposals[proposalId];

        /** Check the msg.sender is an approved address */
        require(
            isApproved(proposal, msgSender) > 0,
            "msg.sender not an approved address"
        );

        uint256[] memory indexes = new uint256[](proposal.headUpdates.length);
        for (uint256 ix = 0; ix < proposal.headUpdates.length; ix++) {
            indexes[ix] = ix;
        }

        executeProposalPartiallyInternal(proposalId, indexes, msgSender);
    }


    function executeProposalExternal(bytes32 proposalId) external {
        executeProposalInternal(proposalId, msg.sender);
    }

    function executeProposalPartially(
        bytes32 proposalId,
        uint256[] memory indexes
    ) public {
        executeProposalPartiallyInternal(proposalId, indexes, msg.sender);
    }

    function executeProposalPartiallyInternal(
        bytes32 proposalId,
        uint256[] memory indexes,
        address msgSender
    ) private {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.authorized != 0, "Proposal not authorized");

        require(
            isApproved(proposal, msgSender) > 0,
            "msg.sender not an approved address"
        );

        for (uint256 ix = 0; ix < indexes.length; ix++) {
            HeadUpdate storage headUpdate = proposal.headUpdates[indexes[ix]];

            require(headUpdate.executed == 0, "head update already executed");
            headUpdate.executed = 1;

            uprtclRoot.updateHead(headUpdate.perspectiveIdHash, headUpdate.headCid1, headUpdate.headCid0, address(0));
        }
    }

    function getProposal(bytes32 proposalId)
        public
        view
        returns (Proposal memory proposal)
    {
        return (proposals[proposalId]);
    }
}
