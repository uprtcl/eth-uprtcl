pragma solidity >=0.4.25 <0.6.0;

/** Underscore Protocol Ethereum Service used to store the content of
* _Prtcl perspectives */
contract Uprtcl {

	struct Perspective {
		address owner;
		bytes head;
	}

	mapping (bytes => Perspective) perspectives;

	event PerspectiveAdded(bytes indexed perspectiveId, bytes indexed contextId, address owner);
	event PerspectiveHeadUpdated(bytes indexed perspectiveId, address author, bytes previousHead, bytes newHead);
	event PerspectiveOwnerUpdated(bytes indexed perspectiveId, address newOwner, address previousOwner);

	constructor() public {
	}

	/** Adds a new perspective to the mapping and sets the owner. The head pointer is initialized as null and should
	 *  be updated independently using updateHead(). The contextId is not persisted but emited in the PerspectiveAdded
	 *  event to enable filtering. Validation of the perspectiveId to contextId should be done externally using any
	 * 	content addressable	storage solution for the perspectiveId. */
	function addPerspective(bytes memory perspectiveId, bytes memory contextId, address owner) public returns(bool success) {

		Perspective memory perspective = perspectives[perspectiveId];
		require(address(0) != owner, "owner cant be empty");
		require(address(0) == perspective.owner, "existing perspective");

		perspective.owner = owner;
		perspectives[perspectiveId] = perspective;
		emit PerspectiveAdded(perspectiveId, contextId, perspective.owner);

		return true;
	}

	/** Updates the head pointer of a given perspective. Available only to the owner of that perspective. */
	function updateHead(bytes memory perspectiveId, bytes memory newHead) public returns(bool success) {

		Perspective memory perspective = perspectives[perspectiveId];
		require(msg.sender == perspective.owner, "unauthorized access");

		bytes memory parentHead = perspective.head;
		perspective.head = newHead;
		emit PerspectiveHeadUpdated(perspectiveId, msg.sender, parentHead, perspective.head);

    return true;
	}

	/** Changes the owner of a given perspective. Available only to the current owner of that perspective. */
	function changeOwner(bytes memory perspectiveId, address newOwner) public returns(bool success){

    Perspective memory perspective = perspectives[perspectiveId];
		require(msg.sender == perspective.owner, "unauthorized access");

    address previousOwner;
		perspective.owner = newOwner;
		emit PerspectiveOwnerUpdated(perspectiveId, previousOwner, perspective.owner);

    return true;
	}

	/** Get the perspective owner and head from its ID */
	function getPerspective(bytes memory perspectiveId)
		public view returns(address owner, bytes memory head) {

		Perspective memory perspective = perspectives[perspectiveId];
		return (perspective.owner, perspective.head);
	}

}
