pragma solidity >=0.5.0 <0.6.0;
pragma experimental ABIEncoderV2;

import "./UprtclRoot.sol";
import "./UprtclDetails.sol";
import "./UprtclProposals.sol";
import "./UprtclHomePerspectives.sol";

contract UprtclDAOWrapper is Ownable {
    UprtclRoot uprtclRoot;
    UprtclDetails uprtclDetails;
    UprtclProposals uprtclProposals;
    UprtclHomePerspectives uprtclHomePerspectives;

    function setDependencies(
        UprtclRoot _uprtclRoot,
        UprtclDetails _uprtclDetails,
        UprtclProposals _uprtclProposals,
        UprtclHomePerspectives _uprtclHomePerspectives
    ) external onlyOwner {
        uprtclRoot = _uprtclRoot;
        uprtclDetails = _uprtclDetails;
        uprtclProposals = _uprtclProposals;
        uprtclHomePerspectives = _uprtclHomePerspectives;
    }

    function setHomePerspective(string calldata perspectiveId) external {
        uprtclHomePerspectives.setHomePerspectiveSuperUser(
            perspectiveId,
            msg.sender
        );
    }

    function authorizeProposal(
        bytes32 proposalId,
        uint8 authorized,
        bool execute
    ) external {
        uprtclProposals.authorizeProposalSuperUser(
            proposalId,
            authorized,
            execute,
            msg.sender
        );
    }

    function changePerspectiveOwner(
        bytes32 perspectiveIdHash,
        address newOwner
    ) external {
        uprtclRoot.changePerspectiveOwnerSuperUser(
            perspectiveIdHash,
            newOwner,
            msg.sender
        );
    }

    function setPerspectiveDetails(
        bytes32 perspectiveIdHash,
        string memory context
    ) public {
        uprtclDetails.setPerspectiveDetailsSuperUser(
            perspectiveIdHash,
            context,
            msg.sender
        );
    }

    /** create the perspectives and initialize a new proposal on one tx */
    function createAndInitProposal(
        UprtclRoot.NewPerspective[] memory newPerspectives,
        UprtclProposals.NewProposal memory newProposal,
        address account) public {

        uprtclRoot.createPerspectiveBatch(newPerspectives, account);
        uprtclProposals.initProposal(newProposal, account);
    }

}
