pragma solidity >=0.4.25 <0.6.0;

/** Underscore Protocol Ethereum Service used to store the content of
* _Prtcl perspectives */
contract Uprtcl {

	struct Perspective {
		address owner;
		string headCid;
	}

	struct HeadUpdate {
		bytes32 perspectiveIdHash;
		string headCid;
	}

	struct HeadUpdateBatch {
		HeadUpdate[]
		owner 
		authorized
	}

	mapping (bytes32 => Perspective) public perspectives;
	mapping (bytes32 => HeadUpdate[]) public batches;

	event PerspectiveAdded(
		bytes32 indexed perspectiveIdHash,
		bytes32 indexed contextIdHash,
		string head,
		address owner,
		string perspectiveCid);

	event PerspectiveHeadUpdated(
		bytes32 indexed perspectiveIdHash,
		address author,
		string previousHeadCid,
		string newHeadCid);

	event PerspectiveOwnerUpdated(
		bytes32 indexed perspectiveIdHash,
		address newOwner,
		address previousOwner);

	constructor() public {
	}

	/** Adds a new perspective to the mapping and sets the owner. The head pointer is initialized as null and should
	 *  be updated independently using updateHead(). The contextId is not persisted but emited in the PerspectiveAdded
	 *  event to enable filtering. Validation of the perspectiveId to contextId should be done externally using any
	 * 	content addressable	storage solution for the perspectiveId. The perspectiveCid is emited to help perspectiveHash
	 *  reverse mapping */
	function addPerspective(
		bytes32 perspectiveIdHash,
		bytes32 contextIdHash,
		string memory head,
		address owner,
		string memory perspectiveCid) /** LSB */
		public {

		Perspective storage perspective = perspectives[perspectiveIdHash];
		require(address(0) != owner, "owner cant be empty");
		require(address(0) == perspective.owner, "existing perspective");

		perspective.owner = owner;
		perspective.headCid = head;

		perspectives[perspectiveIdHash] = perspective;

		emit PerspectiveAdded(
			perspectiveIdHash,
			contextIdHash,
			perspective.headCid,
			perspective.owner,
			perspectiveCid);
	}

	/** Updates the head pointer of a given perspective. Available only to the owner of that perspective. */
	function updateHead(
		bytes32 perspectiveIdHash,
		string memory newHead) public {

		Perspective storage perspective = perspectives[perspectiveIdHash];
		require(msg.sender == perspective.owner, "unauthorized access");

		string memory parentHead = perspective.headCid;
		perspective.headCid = newHead;

		emit PerspectiveHeadUpdated(
			perspectiveIdHash,
			msg.sender,
			parentHead,
			perspective.headCid);
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
		returns(
			address owner,
			string memory headCid) {

		Perspective memory perspective = perspectives[perspectiveIdHash];

		return (
			perspective.owner,
			perspective.headCid);
	}

	function proposeBatchUpdate(Head[] memory newHeads, bytes32 batchId) {
		assert(batches[batchId].length == 0, "Batch id not available");
		
		batches[batchId] = newHeads;

		emit BatchCreated(batchId, msg.sender);
	}

	function authorizeBatchUpdate() {
		for() {
			
		}
	}

	function executeBatchUpdate() {
		for() {
			updateHead()
		}
	}

	function BatchUpdate() {
		for() {
			updateHead()
		}
	}

}
