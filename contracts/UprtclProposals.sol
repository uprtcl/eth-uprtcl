pragma solidity >=0.5.0 <0.6.0;
pragma experimental ABIEncoderV2;

import "./UprtclRoot.sol";

contract UprtclProposals is Ownable {

    struct HeadUpdate {
        bytes32 perspectiveIdHash;
        bytes32 headCid0;
        bytes32 headCid1;
        uint8 executed;
    }

    struct Proposal {
        bytes32 toPerspectiveIdHash;
        bytes32 fromPerspectiveIdHash;
        address owner;
        HeadUpdate[] headUpdates;
        address[] approvedAddresses;
        uint8 status;
        uint8 authorized;
    }

    mapping(bytes32 => Proposal) public proposals;

    UprtclRoot uprtclRoot;

    event ProposalCreated(
        bytes32 indexed toPerspectiveIdHash,
        bytes32 indexed fromPerspectiveIdHash,
        uint32 nonce,
        bytes32 indexed proposalId
    );

    function getProposalId(
        bytes32 toPerspectiveIdHash,
        bytes32 fromPerspectiveIdHash,
        uint32 nonce
    ) public pure returns (bytes32 proposalId) {
        proposalId = keccak256(
            abi.encodePacked(toPerspectiveIdHash, fromPerspectiveIdHash, nonce)
        );
    }

    function initProposal(
        bytes32 toPerspectiveIdHash,
        bytes32 fromPerspectiveIdHash,
        address owner,
        uint32 nonce,
        HeadUpdate[] memory headUpdates,
        address[] memory approvedAddresses
    ) public {
        bytes32 proposalId = getProposalId(
            toPerspectiveIdHash,
            fromPerspectiveIdHash,
            nonce
        );

        /** make sure the proposal does not exist */
        Proposal storage proposal = proposals[proposalId];
        require(proposal.owner == address(0), "proposal already exist");

        proposal.toPerspectiveIdHash = toPerspectiveIdHash;
        proposal.fromPerspectiveIdHash = fromPerspectiveIdHash;
        proposal.owner = owner;
        proposal.approvedAddresses = approvedAddresses;
        proposal.status = 1;

        addUpdatesToProposal(proposalId, headUpdates);

        emit ProposalCreated(
            toPerspectiveIdHash,
            fromPerspectiveIdHash,
            nonce,
            proposalId
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
        HeadUpdate[] memory headUpdates
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
            HeadUpdate memory headUpdate = headUpdates[ix];
            require(
                headUpdate.executed == 0,
                "head update executed property must be zero"
            );
            require(
                uprtclRoot.getPerspectiveOwner(headUpdate.perspectiveIdHash) == proposal.owner,
                "proposal can only store perspectives owned by its owner"
            );
            proposal.headUpdates.push(headUpdate);
        }
    }

    function setProposalStatus(bytes32 proposalId, uint8 status) public {
        Proposal storage proposal = proposals[proposalId];
        require(
            msg.sender == proposal.owner,
            "Proposal status can only by set by its owner"
        );
        proposal.status = status;
    }

    function setProposalAuthorized(bytes32 proposalId, uint8 authorized) public {
        Proposal storage proposal = proposals[proposalId];
        require(
            msg.sender == proposal.owner,
            "Proposal can only by authorized by its owner"
        );
        /** by default the proposal is closed once it is authorized. */
        if (authorized > 0) proposal.status = 0;
        proposal.authorized = authorized;
    }

    function executeProposal(bytes32 proposalId, address account) public {
        Proposal storage proposal = proposals[proposalId];

        /** Check the msg.sender is an approved address */
        require(
            isApproved(proposal, msg.sender) > 0,
            "msg.sender not an approved address"
        );

        uint256[] memory indexes = new uint256[](proposal.headUpdates.length);
        for (uint256 ix = 0; ix < proposal.headUpdates.length; ix++) {
            indexes[ix] = ix;
        }

        executeProposalPartiallyInternal(proposalId, indexes, msg.sender, account);
    }

    function executeProposalPartially(
        bytes32 proposalId,
        uint256[] memory indexes,
        address account
    ) public {
        executeProposalPartiallyInternal(proposalId, indexes, msg.sender, account);
    }

    function executeProposalPartiallyInternal(
        bytes32 proposalId,
        uint256[] memory indexes,
        address msgSender,
        address account
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

            uprtclRoot.updateHead(headUpdate.perspectiveIdHash, headUpdate.headCid0, headUpdate.headCid1, account);
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
