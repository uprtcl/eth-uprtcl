pragma solidity >=0.5.0 <0.6.0;
pragma experimental ABIEncoderV2;

import "./UprtclRoot.sol";
import "./Ownable.sol";

contract UprtclDetails is Ownable {

    struct PerspectiveDetails {
        string name;
        string context;
    }

    event PerspectiveDetailsSet (
        bytes32 indexed perspectiveIdHash,
        bytes32 indexed contextHash
    );

    mapping(bytes32 => PerspectiveDetails) public perspectivesDetails;

    UprtclRoot uprtclRoot;

    function setUprtclRoot(UprtclRoot _uprtclRoot) public onlyOwner {
        uprtclRoot = _uprtclRoot;
    }

    /** Adds a new perspective to the mapping and sets the owner. The head pointer and the context. */
    function setPerspectiveDetailsInternal(
        bytes32 perspectiveIdHash,
        PerspectiveDetails memory newDetails,
        address sender
    ) private {
        require(uprtclRoot.getPerspectiveOwner(perspectiveIdHash) == sender, "details can only by set by perspective owner");

        PerspectiveDetails storage details = perspectivesDetails[perspectiveIdHash];

        details.name = newDetails.name;
        details.context = newDetails.context;

        perspectivesDetails[perspectiveIdHash] = details;

        emit PerspectiveDetailsSet(
            perspectiveIdHash,
            keccak256(abi.encodePacked(details.context))
        );
    }

    function setPerspectiveDetails(
        bytes32 perspectiveIdHash,
        PerspectiveDetails memory newDetails
    ) public {
        setPerspectiveDetailsInternal(perspectiveIdHash, newDetails, msg.sender);
    }

    function getPerspectiveDetails(bytes32 perspectiveIdHash) public view returns (string memory name, string memory context) {
        PerspectiveDetails memory details = perspectivesDetails[perspectiveIdHash];
        return (details.name, details.context);
    }

    function initPerspective(
        UprtclRoot.NewPerspective memory newPerspective,
        PerspectiveDetails memory newDetails,
        address account) public {

        /** collect fee here */
        uint256 fee = uprtclRoot.getAddFee();
        if (fee > 0) {
            uprtclRoot.consume(account, msg.sender, fee);
        }

        uprtclRoot.addPerspective(newPerspective, account);
        setPerspectiveDetailsInternal(newPerspective.perspectiveIdHash, newDetails, newPerspective.owner);
    }

}
