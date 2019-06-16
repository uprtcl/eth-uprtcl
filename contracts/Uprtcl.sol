pragma solidity >=0.4.25 <0.6.0;

/** Underscore Protocol Ethereum Service used to store the content of
* _Prtcl perspectives */
contract Uprtcl {

	struct Perspective {
		address owner;
		bytes32 head1;
		bytes32 head0; /* less significant bit */
	}

	mapping (bytes32 => Perspective) public perspectives;

	event PerspectiveAdded(
		bytes32 indexed perspectiveIdHash,
		bytes32 indexed contextIdHash,
		address owner);

	event PerspectiveHeadUpdated(
		bytes32 indexed perspectiveIdHash,
		address author,
		bytes32 previousHead1,
		bytes32 previousHead0,
		bytes32 newHead1,
		bytes32 newHead0);

	event PerspectiveOwnerUpdated(
		bytes32 indexed perspectiveIdHash,
		address newOwner,
		address previousOwner);

	constructor() public {
	}

	/** Adds a new perspective to the mapping and sets the owner. The head pointer is initialized as null and should
	 *  be updated independently using updateHead(). The contextId is not persisted but emited in the PerspectiveAdded
	 *  event to enable filtering. Validation of the perspectiveId to contextId should be done externally using any
	 * 	content addressable	storage solution for the perspectiveId. */
	function addPerspective(
		bytes32 perspectiveIdHash,
		bytes32 contextIdHash,
		address owner)
		public {

		Perspective storage perspective = perspectives[perspectiveIdHash];
		require(address(0) != owner, "owner cant be empty");
		require(address(0) == perspective.owner, "existing perspective");

		perspective.owner = owner;
		perspectives[perspectiveIdHash] = perspective;
		emit PerspectiveAdded(perspectiveIdHash, contextIdHash, perspective.owner);
	}

	/** Updates the head pointer of a given perspective. Available only to the owner of that perspective. */
	function updateHead(bytes32 perspectiveIdHash, bytes32 newHead1, bytes32 newHead0) public {

		Perspective storage perspective = perspectives[perspectiveIdHash];
		require(msg.sender == perspective.owner, "unauthorized access");

		bytes32 parentHead1 = perspective.head1;
		bytes32 parentHead0 = perspective.head0;

		perspective.head1 = newHead1;
		perspective.head0 = newHead0;

		emit PerspectiveHeadUpdated(perspectiveIdHash, msg.sender, parentHead1, parentHead0, perspective.head1, perspective.head0);
	}

	/** Changes the owner of a given perspective. Available only to the current owner of that perspective. */
	function changeOwner(bytes32 perspectiveIdHash, address newOwner) public {

    Perspective storage perspective = perspectives[perspectiveIdHash];
		require(msg.sender == perspective.owner, "unauthorized access");

    address previousOwner = perspective.owner;
		perspective.owner = newOwner;

		emit PerspectiveOwnerUpdated(perspectiveIdHash, perspective.owner, previousOwner);
	}

	/** Get the perspective owner and head from its ID */
	function getPerspective(bytes32 perspectiveIdHash)
		public view
		returns(address owner, bytes32 head1, bytes32 head0) {

		Perspective memory perspective = perspectives[perspectiveIdHash];
		return (perspective.owner, perspective.head1, perspective.head0);
	}

}
