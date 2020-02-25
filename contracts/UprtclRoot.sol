pragma solidity >=0.5.0 <0.6.0;
pragma experimental ABIEncoderV2;

import "./Ownable.sol";
import "./SafeMath.sol";

import "./UprtclAccounts.sol";

/** Underscore Protocol Ethereum Service used to store the content of
* _Prtcl perspectives */
contract UprtclRoot is Ownable {
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

    /** superUsers can update any perspective */
    mapping(address => bool) private superUsers;
    mapping(uint256 => uint256) public fees;

    mapping(bytes32 => Perspective) public perspectives;

    event PerspectiveOwnerUpdated(
        bytes32 indexed perspectiveIdHash,
        address newOwner,
        address previousOwner
    );

    UprtclAccounts public accounts;

    function setAccounts(UprtclAccounts _accounts) public onlyOwner {
        accounts = _accounts;
    }

    function setSuperUser(address suAddress) public onlyOwner {
        superUsers[suAddress] = true;
    }

    function withdraw(uint256 amount) public onlyOwner {
        this.owner().transfer(amount);
    }

    function setFees(uint256 addFee, uint256 updateFee) public onlyOwner {
        fees[0] = addFee;
        fees[1] = updateFee;
    }

    function getFees() public view returns (uint256 addFee, uint256 updateFee) {
        return (fees[0], fees[1]);
    }

    function getAddFee() public view returns (uint256) {
        return fees[0];
    }

    function getUpdateFee() public view returns (uint256) {
        return fees[1];
    }

    function consume(address account, address by, uint256 amount) public {
        require(superUsers[msg.sender] == true, "only super user");
        accounts.consume(account, by, amount);
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

    function addPerspective(NewPerspective memory newPerspective, address account)
        public
    {
        if (!superUsers[msg.sender]) {
            uint256 fee = getAddFee();
            if (fee > 0) {
                accounts.consume(account, msg.sender, fee);
            }
        }
        addPerspectiveInternal(newPerspective);
    }

    function addPerspectiveBatch(NewPerspective[] memory newPerspectives, address account)
        public
    {
        uint256 nPerspectives = newPerspectives.length;

        if (!superUsers[msg.sender]) {
            uint256 fee = getUpdateFee().mul(nPerspectives);

            if (fee > 0) {
                accounts.consume(account, msg.sender, fee);
            }
        }

        for (uint256 ix = 0; ix < nPerspectives; ix++) {
            addPerspectiveInternal(newPerspectives[ix]);
        }
    }

    function updateHead(
        bytes32 perspectiveIdHash,
        bytes32 newHeadCid1,
        bytes32 newHeadCid0,
        address account
    ) public {
        if (!superUsers[msg.sender]) {
            uint256 fee = getUpdateFee();
            if (fee > 0) {
                accounts.consume(account, msg.sender, fee);
            }
        }

        Perspective storage perspective = perspectives[perspectiveIdHash];

        require(
            (perspective.owner == msg.sender) || (superUsers[msg.sender] == true),
            "only the owner can update the perspective"
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
