pragma solidity ^0.5.0;

import "./Ownable.sol";

contract HasSuperUsers is Ownable {
    mapping(address => bool) private superUsers;

    modifier onlySuperUser() {
        require(isSuperUser(msg.sender), "HasSuperUsers: caller is not a superUser");
        _;
    }

    function isSuperUser(address suAddress) public view returns (bool) {
        return superUsers[suAddress];
    }

    function setSuperUser(address suAddress, bool value) public onlyOwner {
        superUsers[suAddress] = value;
    }
}
