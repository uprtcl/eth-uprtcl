pragma solidity >=0.5.0 <0.6.0;
pragma experimental ABIEncoderV2;

/** Underscore Protocol Ethereum Service used to store the content of
* _Prtcl perspectives */
contract Uprtcl {
    struct Perspective {
        address owner;
        bytes32 headCid1;
        bytes32 headCid0;
        bytes32 context1;
        bytes32 context0;
    }

    mapping(bytes32 => Perspective) public perspectives;

    event PerspectiveAdded(
        bytes32 indexed perspectiveIdHash,
        bytes32 indexed context0
    );

    event PerspectiveUpdated(
        bytes32 indexed perspectiveIdHash
    );

    event PerspectiveOwnerUpdated(
        bytes32 indexed perspectiveIdHash,
        address newOwner,
        address previousOwner
    );

    /** Adds a new perspective to the mapping and sets the owner. The head pointer and the context. */
    function addPerspective(
        bytes32 perspectiveCid1,
        bytes32 perspectiveCid0,
        bytes32 context1,
        bytes32 context0,
        bytes32 headCid1,
        bytes32 headCid0,
        address owner
    ) public {

        bytes32 perspectiveIdHash = keccak256(abi.encodePacked(perspectiveCid1, perspectiveCid0));

        Perspective storage perspective = perspectives[perspectiveIdHash];
        require(address(0) != owner, "owner cannot be empty");
        require(address(0) == perspective.owner, "existing perspective");

        perspective.owner = owner;
        perspective.headCid1 = headCid1;
        perspective.headCid0 = headCid0;
        perspective.context1 = context1;
        perspective.context0 = context0;

        perspectives[perspectiveIdHash] = perspective;

        emit PerspectiveAdded(
            perspectiveIdHash,
            context0
        );
    }

    function updatePerspectiveDetails(
        bytes32 perspectiveIdHash,
        bytes32 newHeadCid1,
        bytes32 newHeadCid0,
        bytes32 newContext1,
        bytes32 newContext0
    ) public {
        Perspective storage perspective = perspectives[perspectiveIdHash];

        require(
            perspective.owner == msg.sender,
            "only the owner can update the perspective"
        );

        if (newHeadCid0 != bytes32(0)) {
            perspective.headCid0 = newHeadCid0;
            perspective.headCid1 = newHeadCid1;
        }

        if (newContext0 != bytes32(0)) {
            perspective.context0 = newContext0;
            perspective.context1 = newContext1;
        }

        emit PerspectiveUpdated(
            perspectiveIdHash
        );
    }

    function changeOwnerInternal(
        bytes32 perspectiveIdHash,
        address newOwner,
        address sender) private {

        Perspective storage perspective = perspectives[perspectiveIdHash];
        require(sender == perspective.owner, "unauthorized access");

        address previousOwner = perspective.owner;
        perspective.owner = newOwner;

        emit PerspectiveOwnerUpdated(
            perspectiveIdHash,
            perspective.owner,
            previousOwner
        );
    }

    /** Changes the owner of a given perspective. Available only to the current owner of that perspective. */
    function changeOwner(
        bytes32 perspectiveIdHash,
        address newOwner) public {
        changeOwnerInternal(perspectiveIdHash, newOwner, msg.sender);
    }

    /** Get the perspective owner and details from its ID */
    function getPerspectiveDetails(
        bytes32 perspectiveIdHash)
        public
        view
        returns (
            address owner,
            bytes32 headCid1,
            bytes32 headCid0,
            bytes32 context1,
            bytes32 context0
        )
    {
        Perspective memory perspective = perspectives[perspectiveIdHash];

        return (
            perspective.owner,
            perspective.headCid1,
            perspective.headCid0,
            perspective.context1,
            perspective.context0
        );
    }

}
