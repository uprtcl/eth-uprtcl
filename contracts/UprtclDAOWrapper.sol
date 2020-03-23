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
        UprtclProposals uUprtclProposals,
        UprtclHomePerspectives _uprtclHomePerspectives
    ) external onlyOwner {
        uprtclRoot = _uprtclRoot;
        uprtclDetails = _uprtclDetails;
        uprtclProposals = uUprtclProposals;
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
        bool execute,
        address proposalOwner
    ) external onlyOwner {
        uprtclProposals.authorizeProposalSuperUser(
            proposalId,
            authorized,
            execute,
            proposalOwner
        );
    }

    function changeOwner(
        bytes32 perspectiveIdHash,
        address newOwner,
        address oldOwner
    ) external onlyOwner {
        uprtclRoot.changePerspectiveOwnerSuperUser(
            perspectiveIdHash,
            newOwner,
            oldOwner
        );
    }

    function setPerspectiveDetails(
        bytes32 perspectiveIdHash,
        SharedPerspectiveDetails.PerspectiveDetails memory newDetails
    ) public {
        uprtclDetails.setPerspectiveDetailsSuperUser(
            perspectiveIdHash,
            newDetails,
            msg.sender
        );
    }

}
