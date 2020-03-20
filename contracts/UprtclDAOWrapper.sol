pragma solidity >=0.5.0 <0.6.0;
pragma experimental ABIEncoderV2;

import "./UprtclRoot.sol";
...

contract UprtclDAOWrapper is Ownable {

    UprtclRoot uprtclRoot;
    UprtclDetails uprtclDetails;
    UprtclProposals uprtclProposals;
    UprtclHomePerspectives uprtclHomePerspectives;

    function setDependencies(UprtclRoot _uprtclRoot, UprtclRoot _uprtclRoot....) external onlyOwner {
        uprtclRoot = _uprtclRoot;
        ...
        UprtclDetails = _uprtclDetails;
    }

    function setHomePerspective(string calldata perspectiveId) external {
        uprtclHomePerspectives.setHomePerspective(msg.sender)
    }

    ...

    authorizeProposal() {
        uprtclProposals.authorizeProposal(...)
    }

    changeOwner() {
        uprtclRoot.changeOwner(..)
    }

    setPerspectiveDetails() {
        uprtclDetails.setPerspectiveDetails(...)
    }

}
