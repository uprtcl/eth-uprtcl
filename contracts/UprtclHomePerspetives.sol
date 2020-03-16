pragma solidity >=0.5.0 <0.6.0;

contract UprtclHomePerspectives {
    mapping(address => string) public homePerspectives;

    function getHomePerspective(address owner) external view returns (string memory home) {
        return homePerspectives[owner];
    }

    function setHomePerspective(string calldata perspectiveId) external {
        homePerspectives[msg.sender] = perspectiveId;
    }

}
