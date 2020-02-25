pragma solidity >=0.5.0 <0.6.0;
pragma experimental ABIEncoderV2;

import "./UprtclRoot.sol";

contract UprtclDetails {

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

    constructor(UprtclRoot _uprtclRoot) public {
        uprtclRoot = _uprtclRoot;
    }

    /** Adds a new perspective to the mapping and sets the owner. The head pointer and the context. */
    function setPerspectiveDetails(
        bytes32 perspectiveIdHash,
        PerspectiveDetails memory newDetails
    ) public {
        require(uprtclRoot.getPerspectiveOwner(perspectiveIdHash) == msg.sender, "details can only by set by perspective owner");

        PerspectiveDetails storage details = perspectivesDetails[perspectiveIdHash];

        details.name = newDetails.name;
        details.context = newDetails.context;

        perspectivesDetails[perspectiveIdHash] = details;

        emit PerspectiveDetailsSet(
            perspectiveIdHash,
            keccak256(abi.encodePacked(details.context))
        );
    }

    function getPerspectiveDetails(bytes32 perspectiveIdHash) public view returns (string memory name, string memory context) {
        PerspectiveDetails memory details = perspectivesDetails[perspectiveIdHash];
        return (details.name, details.context);
    }

    function initPerspective(
        UprtclRoot.NewPerspective memory newPerspective,
        PerspectiveDetails memory newDetails,
        address account) public {

        uprtclRoot.addPerspective(newPerspective, account);
        setPerspectiveDetails(newPerspective.perspectiveIdHash, newDetails);
    }

}
