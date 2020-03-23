pragma solidity >=0.5.0 <0.6.0;

import "./HasSuperUsers.sol";

contract UprtclHomePerspectives is HasSuperUsers {
    mapping(address => string) public homePerspectives;

    function getHomePerspective(address owner) external view returns (string memory home) {
        return homePerspectives[owner];
    }

    function setHomePerspectiveInternal(string memory perspectiveId, address msgSender) private onlySuperUser {
        homePerspectives[msgSender] = perspectiveId;
    }

    function setHomePerspective(string calldata perspectiveId, address msgSender) external {
        setHomePerspectiveInternal(perspectiveId, msgSender);
    }
}