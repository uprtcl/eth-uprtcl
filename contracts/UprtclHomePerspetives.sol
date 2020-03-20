pragma solidity >=0.5.0 <0.6.0;

contract UprtclHomePerspectives is HasSuperUsers {
    mapping(address => string) public homePerspectives;

    function getHomePerspective(address owner) external view returns (string memory home) {
        return homePerspectives[owner];
    }

    function setHomePerspectiveInternal(string memory perspectiveId, address msgSender) public onlySuperUser {
        homePerspectives[msgSender] = perspectiveId;
    }

    function setHomePerspective(string calldata perspectiveId) external {
        setHomePerspectiveInternal(perspectiveId, msg.sender);
    }

}
