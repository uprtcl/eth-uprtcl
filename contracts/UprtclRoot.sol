pragma solidity >=0.5.0 <0.6.0;
pragma experimental ABIEncoderV2;

import "./Toll.sol";
import "./SafeMath.sol";

/** Underscore Protocol Ethereum Service used to store the content of
* _Prtcl perspectives */
contract UprtclRoot is Toll {
    using SafeMath for uint256;

    struct Perspective {
        address owner;
        bytes32 headCid1;
        bytes32 headCid0;
    }

    struct NewPerspective {
        bytes32 perspectiveIdHash;
        bytes32 headCid1;
        bytes32 headCid0;
        address owner;
    }

    mapping(bytes32 => Perspective) public perspectives;
    private address grantee;

    event PerspectiveOwnerUpdated(
        bytes32 indexed perspectiveIdHash,
        address newOwner,
        address previousOwner
    );

    function setGrantee(address _grantee) public {
        grantee = _grantee;
    }

    /** Adds a new perspective to the mapping and sets the owner. The head pointer and the context. */
    function addPerspectiveInternal(NewPerspective memory newPerspective)
        private
    {
        bytes32 perspectiveIdHash = newPerspective.perspectiveIdHash;

        Perspective storage perspective = perspectives[perspectiveIdHash];
        require(address(0) != newPerspective.owner, "owner cannot be empty");
        require(address(0) == perspective.owner, "existing perspective");

        perspective.owner = newPerspective.owner;
        perspective.headCid1 = newPerspective.headCid1;
        perspective.headCid0 = newPerspective.headCid0;

        perspectives[perspectiveIdHash] = perspective;
    }

    function addPerspective(NewPerspective memory newPerspective)
        public
        payable
    {
        require(msg.value >= getAddFee(), "add fee not enough");
        addPerspectiveInternal(newPerspective);
    }

    function addPerspectiveBatch(NewPerspective[] memory newPerspectives)
        public
        payable
    {
        uint256 nPerspectives = newPerspectives.length;

        require(
            msg.value >= (getAddFee().mul(nPerspectives)),
            "add fee not enough"
        );

        for (uint256 ix = 0; ix < nPerspectives; ix++) {
            addPerspectiveInternal(newPerspectives[ix]);
        }
    }

    function updateHead(
        bytes32 perspectiveIdHash,
        bytes32 newHeadCid1,
        bytes32 newHeadCid0
    ) public payable {
        require(msg.value >= getUpdateFee(), "update fee not added");

        Perspective storage perspective = perspectives[perspectiveIdHash];

        require(
            (perspective.owner == msg.sender) || (grantee == msg.sender),
            "only the owner or grantee can update the perspective"
        );

        if (newHeadCid0 != bytes32(0)) {
            perspective.headCid0 = newHeadCid0;
            perspective.headCid1 = newHeadCid1;
        }
    }

    function changePerspectiveOwnerInternal(
        bytes32 perspectiveIdHash,
        address newOwner,
        address sender
    ) private {
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
    function changePerspectiveOwner(bytes32 perspectiveIdHash, address newOwner)
        public
    {
        changePerspectiveOwnerInternal(perspectiveIdHash, newOwner, msg.sender);
    }

    function changePerspectiveOwnerBatch(
        bytes32[] memory perspectiveIdsHashes,
        address newOwner
    ) public {
        for (uint256 ix = 0; ix < perspectiveIdsHashes.length; ix++) {
            changePerspectiveOwnerInternal(
                perspectiveIdsHashes[ix],
                newOwner,
                msg.sender
            );
        }
    }

    /** Get the perspective owner and details from its ID */
    function getPerspectiveDetails(bytes32 perspectiveIdHash)
        public
        view
        returns (address owner, bytes32 headCid1, bytes32 headCid0)
    {
        Perspective memory perspective = perspectives[perspectiveIdHash];

        return (perspective.owner, perspective.headCid1, perspective.headCid0);
    }

    /** Get the perspective owner and details from its ID */
    function getPerspectiveOwner(bytes32 perspectiveIdHash)
        public
        view
        returns (address owner)
    {
        Perspective memory perspective = perspectives[perspectiveIdHash];

        return (perspective.owner);
    }

}
