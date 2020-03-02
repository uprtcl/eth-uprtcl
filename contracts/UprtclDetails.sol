pragma solidity >=0.5.0 <0.6.0;
pragma experimental ABIEncoderV2;

import "./UprtclRoot.sol";
import "./Ownable.sol";
import "./SafeMath.sol";

contract UprtclDetails is Ownable {
    using SafeMath for uint256;

    struct PerspectiveDetails {
        string name;
        string context;
    }

    struct InitPerspective {
        UprtclRoot.NewPerspective perspective;
        PerspectiveDetails details;
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

    function getContextHash(string memory context) public pure returns (bytes32 contextHash) {
        return keccak256(abi.encodePacked(context));
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
            getContextHash(details.context)
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

    function initPerspectiveInternal(InitPerspective memory perspectiveData, address account) private {
        uprtclRoot.createPerspective(perspectiveData.perspective, account);

        setPerspectiveDetailsInternal(
            uprtclRoot.getPerspectiveIdHash(perspectiveData.perspective.perspectiveId),
            perspectiveData.details,
            perspectiveData.perspective.owner);
    }

    function initPerspective(
        InitPerspective memory perspectiveData,
        address account) public {

        /** collect fee here */
        uint256 fee = uprtclRoot.getAddFee();
        if (fee > 0) {
            uprtclRoot.consume(account, msg.sender, fee);
        }

        initPerspectiveInternal(perspectiveData, account);
    }

    function initPerspectiveBatch(InitPerspective[] memory perspectivesData, address account)
        public
    {
        uint256 nPerspectives = perspectivesData.length;
        uint256 fee = uprtclRoot.getUpdateFee().mul(nPerspectives);

        if (fee > 0) {
            uprtclRoot.consume(account, msg.sender, fee);
        }

        for (uint256 ix = 0; ix < nPerspectives; ix++) {
            initPerspectiveInternal(perspectivesData[ix], account);
        }
    }

}
