pragma solidity >=0.5.0 <0.6.0;

import "./HasSuperUsers.sol";

contract UprtclHomePerspectives is HasSuperUsers {

    event HomePerspectiveSet(
        address indexed owner,
        string perspectiveId
    );

    function setHomePerspectiveInternal(string memory perspectiveId, address msgSender) private {
        emit HomePerspectiveSet(msgSender, perspectiveId);
    }

    function setHomePerspectiveSuperUser(string calldata perspectiveId, address msgSender) external onlySuperUser {
        setHomePerspectiveInternal(perspectiveId, msgSender);
    }

    function setHomePerspectivePublic(string calldata perspectiveId) external {
        setHomePerspectiveInternal(perspectiveId, msg.sender);
    }
}