pragma solidity >=0.5.0 <0.6.0;
pragma experimental ABIEncoderV2;

import "./Ownable.sol";

/** holds a group of UPR mappings */
contract UPRRegistry is Ownable {

    mapping(bytes32 => string) uprs;

    function setUPR(bytes32 contextHash, string memory value) public onlyOwner {
        uprs[contextHash] = value;
    }

    function getUPR(bytes32 contextHash) public view returns (string memory value) {
        return uprs[contextHash];
    }

}