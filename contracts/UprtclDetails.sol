pragma solidity >=0.5.0 <0.6.0;
pragma experimental ABIEncoderV2;

import "./UprtclRoot.sol";
import "./HasSuperUsers.sol";
import "./SafeMath.sol";

contract UprtclDetails is HasSuperUsers {
    using SafeMath for uint256;

    struct InitPerspective {
        UprtclRoot.NewPerspective perspective;
        string context;
    }

    event PerspectiveDetailsSet (
        bytes32 indexed perspectiveIdHash,
        bytes32 indexed contextHash,
        string context
    );

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
        string memory context,
        address sender
    ) private {
        require(uprtclRoot.getPerspectiveOwner(perspectiveIdHash) == sender, "details can only by set by perspective owner");

        emit PerspectiveDetailsSet(
            perspectiveIdHash,
            getContextHash(context),
            context
        );
    }

    function setPerspectiveDetails(
        bytes32 perspectiveIdHash,
        string memory context
    ) public {
        setPerspectiveDetailsInternal(perspectiveIdHash, context, msg.sender);
    }

    function setPerspectiveDetailsSuperUser(
        bytes32 perspectiveIdHash,
        string memory context,
        address msgSender
    ) public onlySuperUser {
        setPerspectiveDetailsInternal(perspectiveIdHash, context, msgSender);
    }

    function initPerspectiveInternal(InitPerspective memory perspectiveData, address account) private {
        uprtclRoot.createPerspective(perspectiveData.perspective, account);

        setPerspectiveDetailsInternal(
            uprtclRoot.getPerspectiveIdHash(perspectiveData.perspective.perspectiveId),
            perspectiveData.context,
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
