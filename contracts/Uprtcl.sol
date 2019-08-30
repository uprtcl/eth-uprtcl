pragma solidity >=0.4.25 <0.6.0;
pragma experimental ABIEncoderV2;

/** Underscore Protocol Ethereum Service used to store the content of
* _Prtcl perspectives */
contract Uprtcl {

	struct Perspective {
		address owner;
		string headCid;
	}

	struct HeadUpdate {
		bytes32 perspectiveIdHash;
		string headId;
	}

	struct Batch {

		/** Approved addresses can add new HeadUpdate elements to this
		list as long as they are all from the same owner and this owner is
		the same as the one of existing HeadUpdates. */
		HeadUpdate[] headUpdates;

		/** store the owner of this batch. All perspectives in the headUpdates
		must be owner by this owner. */
		address owner;

		address[] approvedAddresses;

		/** Status of the batch. New headUpdates can be added by approved
		addreses as long as status != 0. */
		uint8 status;

		/** Authorizing the batch lets anyone run one or more of
		the head updates in the batch in any order. It can only be called
		by the owner of all the perspectives in the batch. */
		uint8 authorized;
	}

	mapping (bytes32 => Perspective) public perspectives;
	mapping (bytes32 => Batch) public batches;

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

	event BatchCreated(
		bytes32 indexed batchId,
		address indexed owner);

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

	/** Updates the head pointer of a given perspective. It dont
		check the owner to let a sub-contract handle permissions. */
	function updateHead(
		bytes32 perspectiveIdHash,
		string memory newHead) private {

		Perspective storage perspective = perspectives[perspectiveIdHash];

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

	/** One method to execute the head updates directly, without creating the batch. Useful
		if the owner dont want to use the batch authorization feature.
		It also works for updating one single perspective */
	function updateHeads(HeadUpdate[] memory headUpdates) public {
		for (uint8 ix = 0; ix < headUpdates.length; ix++) {
			HeadUpdate memory headUpdate = headUpdates[ix];

			/** Check the msg.sender is the owner */
			Perspective storage perspective = perspectives[headUpdate.perspectiveIdHash];
			require(msg.sender == perspective.owner, "Perspective not owned by msg.sender");

			/** Update the head */
			updateHead(headUpdate.perspectiveIdHash, headUpdate.headId);
		}
	}

	/** Creates a new batch owned and initialize its properties.
		The id of the batch is derived from the message sender to prevent frontrunning attacks. */
	function initBatch(
		address owner,
		uint16 nonce,
		address[] memory approvedAddresses,
		HeadUpdate[] memory headUpdates) public {

		bytes32 batchId = keccak256(abi.encodePacked(msg.sender, nonce));

		/** make sure the batch does not exist */
		require(batches[batchId].owner != address(0), "Batch already exist");
		Batch storage batch = batches[batchId];

		batch.owner = owner;
		batch.approvedAddresses = approvedAddresses;
		batch.headUpdates = headUpdates;
		batch.status = 1;

		addUpdatesToBatch(batchId, headUpdates);

		emit BatchCreated(
			batchId,
			batch.owner
		);
	}

	/** Add one or more headUpdate elements to an existing batch */
	function addUpdatesToBatch(
		bytes32 batchId,
		HeadUpdate[] memory headUpdates) public {

		Batch storage batch = batches[batchId];

		/** make sure the batch is open for new elements */
		require(batch.status != 0, "");

		/** initialize */
		for (uint8 ix = 0; ix < headUpdates.length; ix++) {
			HeadUpdate memory headUpdate = headUpdates[ix];
			/** Only add perspectives of the same owner! */
			Perspective storage newPerspective = perspectives[headUpdate.perspectiveIdHash];
			require(newPerspective.owner == batch.owner, "Batch can only store perspectives owner by its owner");
			batch.headUpdates.push(headUpdate);
		}
	}

	function setBatchAuthorized(bytes32 batchId, uint8 authorized) public {
		Batch storage batch = batches[batchId];
		require(msg.sender == batch.owner, "Batch can only by athorized by its owner");
		/** by default the batch is closed once it is authorized. */
		batch.status = 0;
		batch.authorized = authorized;
	}

	function setBatchStatus(bytes32 batchId, uint8 status) public {
		Batch storage batch = batches[batchId];
		require(msg.sender == batch.owner, "Batch status can only by set by its owner");
		batch.status = status;
	}

	function executeBatch(bytes32 batchId) public {
		Batch storage batch = batches[batchId];
		this.executeBatchPartially(batchId, 0, batch.headUpdates.length);
	}

	function executeBatchPartially(bytes32 batchId, uint256 fromIx, uint256 toIx) public {
		Batch storage batch = batches[batchId];
		require(batch.authorized != 0, "Batch not authorized");

		for (uint256 ix = fromIx; ix < toIx; ix++) {
			HeadUpdate memory headUpdate = batch.headUpdates[ix];
			/** Update the head */
			updateHead(headUpdate.perspectiveIdHash, headUpdate.headId);
		}
	}

	/** Get the perspective owner and head from its ID */
	function getBatch(bytes32 batchId)
		public view
		returns(Batch memory batch) {
		return (batches[batchId]);
	}
}
