pragma solidity >=0.4.25 <0.6.0;
pragma experimental ABIEncoderV2;

/** Underscore Protocol Ethereum Service used to store the content of
* _Prtcl perspectives */
contract Uprtcl {

	struct Perspective {
		address owner;
		string headId;
		string name;
		string context;
	}

	struct HeadUpdate {
		bytes32 perspectiveIdHash;
		string headId;
		uint8 executed;
	}

	struct MergeRequest {

		bytes32 toPerspectiveIdHash;
		bytes32 fromPerspectiveIdHash;

		/** All perspectives in headUpdates must be owned by this owner */
		address owner;

		/** Approved addresses can add new HeadUpdate elements to this
		list as long as they are all from the same owner and this owner is
		the same as the one of existing HeadUpdates. */
		HeadUpdate[] headUpdates;

		address[] approvedAddresses;

		/** Status of the request. New headUpdates can be added by approved
		addreses as long as status != 0. */
		uint8 status;

		/** Authorizing the request lets anyone run one or more of
		the head updates in the request in any order. It can only be called
		by the owner of all the perspectives in the request. */
		uint8 authorized;
	}

  mapping (bytes32 => Perspective) public perspectives;
  mapping (bytes32 => MergeRequest) public requests;
  mapping (address => bytes32) public homePerspectives;

  function getHomePerspective(address owner) public view returns (bytes32) {
      return homePerspectives[owner];
  }

  function setHomePerspective(address owner, bytes32 pidHome) public {
      homePerspectives[owner] = pidHome;
  }

  function changeHomePerspective(bytes32 perspectiveIdHash, bytes32 pidHome) internal {
      require(perspectives[perspectiveIdHash].owner == msg.sender, "Only the owner of the perspective can change the home of it");
      homePerspectives[msg.sender] = pidHome;
      emit homePerspectiveChanged(perspectiveIdHash, pidHome);
  }

  event homePerspectiveChanged(
    bytes32 perspectiveIdHash,
    bytes32 pidHome
  );

	event PerspectiveAdded(
		bytes32 indexed perspectiveIdHash,
		bytes32 indexed contextHash,
		string head,
		string context,
		string name,
		address owner,
		string perspectiveId);

	event PerspectiveDetailsUpdated(
		bytes32 indexed perspectiveIdHash,
		address author,
		string previousHeadId,
		string newHeadId,
		string previousContext,
		string newContext,
		string previousName,
		string newName);

	event PerspectiveOwnerUpdated(
		bytes32 indexed perspectiveIdHash,
		address newOwner,
		address previousOwner);

	event MergeRequestCreated(
		bytes32 indexed toPerspectiveIdHash,
		bytes32 indexed fromPerspectiveIdHash,
		uint32 nonce,
		bytes32 indexed requestId,
		string toPerspectiveId,
		string fromPerspectiveId);

	event AddedUpdatesToRequest(
		bytes32 indexed requestId);


	function isApproved(MergeRequest memory request, address value) private pure returns(uint8 approved){
		for (uint32 ix = 0; ix < request.approvedAddresses.length; ix++) {
			if (value == request.approvedAddresses[ix]) {
				approved = 1;
				return approved;
			}
		}
		approved = 0;
	}

	/** Adds a new perspective to the mapping and sets the owner. The head pointer, the context and the name of the perspective are initialized
	 *  but can be updated independently using updatePerspectiveDetails(). Validation of the perspectiveId to contextHash should be done
	 *  externally using any content addressable storage solution for the perspectiveId.
	 *  The perspectiveId is emited to help perspectiveHash reverse mapping */
	function addPerspective(
		bytes32 perspectiveIdHash,
		bytes32 contextHash,
		string memory headId,
		string memory context,
		string memory name,
		address owner,
		string memory perspectiveId) /** LSB */
		public {

		Perspective storage perspective = perspectives[perspectiveIdHash];
		require(address(0) != owner, "owner cannot be empty");
		require(address(0) == perspective.owner, "existing perspective");

		perspective.owner = owner;
		perspective.headId = headId;
		perspective.context = context;
		perspective.name = name;

		perspectives[perspectiveIdHash] = perspective;

		emit PerspectiveAdded(
			perspectiveIdHash,
			contextHash,
			perspective.headId,
			perspective.context,
			perspective.name,
			perspective.owner,
			perspectiveId);
	}

	function updatePerspectiveDetails(
		bytes32 perspectiveIdHash,
		string memory headId,
		string memory context,
		string memory name) public {

		Perspective storage perspective = perspectives[perspectiveIdHash];

		require(perspective.owner == msg.sender, "only the owner can update the perspective");

		string memory previousHead = perspective.headId;
		string memory previousContext = perspective.context;
		string memory previousName = perspective.name;

		bytes memory testHeadId = bytes(headId);
		if (testHeadId.length != 0) {
			perspective.headId = headId;
		}

		bytes memory testContext = bytes(context);
		if (testContext.length != 0) {
			perspective.context = context;
		}

		bytes memory testName = bytes(name);
		if (testName.length != 0) {
			perspective.name = name;
		}

		emit PerspectiveDetailsUpdated(
			perspectiveIdHash,
			msg.sender,
			previousHead,
			perspective.headId,
			previousContext,
			perspective.context,
			previousName,
			perspective.name);
	}

	/** internal function that updates the head pointer of a given perspective. It dont
		check the owner to let the request functionality do it. Its internal
		so user should use updateHeads instead. */
	function updateHead(
		bytes32 perspectiveIdHash,
		string memory newHead) internal {

		Perspective storage perspective = perspectives[perspectiveIdHash];

		string memory previousHead = perspective.headId;
		perspective.headId = newHead;

		emit PerspectiveDetailsUpdated(
			perspectiveIdHash,
			msg.sender,
			previousHead,
			perspective.headId,
			perspective.context,
			perspective.context,
			perspective.name,
			perspective.name);
	}

	/** Changes the owner of a given perspective. Available only to the current owner of that perspective. */
	function changeOwner(bytes32 perspectiveIdHash, address newOwner) public {

    	Perspective storage perspective = perspectives[perspectiveIdHash];
		require(msg.sender == perspective.owner, "unauthorized access");

    	address previousOwner = perspective.owner;
		perspective.owner = newOwner;

		emit PerspectiveOwnerUpdated(perspectiveIdHash, perspective.owner, previousOwner);
	}

	/** Get the perspective owner and details from its ID */
	function getPerspectiveDetails(bytes32 perspectiveIdHash)
		public view
		returns(
			address owner,
			string memory headId,
			string memory context,
			string memory name) {

		Perspective memory perspective = perspectives[perspectiveIdHash];

		return (
			perspective.owner,
			perspective.headId,
			perspective.context,
			perspective.name);
	}

	/** One method to execute the head updates directly, without creating the request. Useful
		if the owner dont want to use the request authorization feature.
		It also works for updating one single perspective */
	function updateHeads(HeadUpdate[] memory headUpdates) public {
		for (uint8 ix = 0; ix < headUpdates.length; ix++) {
			HeadUpdate memory headUpdate = headUpdates[ix];

			/** Update the head */
			updatePerspectiveDetails(headUpdate.perspectiveIdHash, headUpdate.headId, "", "");
		}
	}

	function getRequestId(
		bytes32 toPerspectiveIdHash,
		bytes32 fromPerspectiveIdHash,
		uint32 nonce)
		public pure
		returns(bytes32 requestId) {

		requestId = keccak256(
			abi.encodePacked(
				toPerspectiveIdHash,
				fromPerspectiveIdHash,
				nonce));
	}

	/** Creates a new request owned and initialize its properties.
		The id of the request is derived from the message sender to prevent frontrunning attacks. */
	function initRequest(
		bytes32 toPerspectiveIdHash,
		bytes32 fromPerspectiveIdHash,
		address owner,
		uint32 nonce,
		HeadUpdate[] memory headUpdates,
		address[] memory approvedAddresses,
		string memory toPerspectiveId,
		string memory fromPerspectiveId) public {

		bytes32 requestId = getRequestId(toPerspectiveIdHash, fromPerspectiveIdHash, nonce);

		/** make sure the request does not exist */
		MergeRequest storage request = requests[requestId];
		require(request.owner == address(0), "request already exist");

		request.toPerspectiveIdHash = toPerspectiveIdHash;
		request.fromPerspectiveIdHash = fromPerspectiveIdHash;
		request.owner = owner;
		request.approvedAddresses = approvedAddresses;
		request.status = 1;

		addUpdatesToRequest(requestId, headUpdates);

		emit MergeRequestCreated(
			toPerspectiveIdHash,
			fromPerspectiveIdHash,
			nonce,
			requestId,
			toPerspectiveId,
			fromPerspectiveId
		);
	}

	/** Add one or more headUpdate elements to an existing request */
	function addUpdatesToRequest(
		bytes32 requestId,
		HeadUpdate[] memory headUpdates) public {

		MergeRequest storage request = requests[requestId];

		/** make sure the request is open for new elements */
		require(request.status != 0, "request status is disabled");

		/** check msg sender is approved address unless is this contract */
		require(isApproved(request, msg.sender) > 0, "msg.sender not an approved address");

		/** initialize */
		for (uint8 ix = 0; ix < headUpdates.length; ix++) {
			HeadUpdate memory headUpdate = headUpdates[ix];
			/** head update executed property must be zero */
			require(headUpdate.executed == 0, "head update executed property must be zero");
			/** Only add perspectives of the same owner as the request */
			Perspective storage newPerspective = perspectives[headUpdate.perspectiveIdHash];
			require(newPerspective.owner == request.owner, "request can only store perspectives owner by its owner");
			request.headUpdates.push(headUpdate);
		}

		emit AddedUpdatesToRequest(requestId);
	}

	function setRequestAuthorized(bytes32 requestId, uint8 authorized) public {
		MergeRequest storage request = requests[requestId];
		require(msg.sender == request.owner, "Request can only by authorized by its owner");
		/** by default the request is closed once it is authorized. */
		if (authorized > 0) request.status = 0;
		request.authorized = authorized;
	}

	function setRequestStatus(bytes32 requestId, uint8 status) public {
		MergeRequest storage request = requests[requestId];
		require(msg.sender == request.owner, "Request status can only by set by its owner");
		request.status = status;
	}

	/** set the status to disabled (0) and can be called by any authorized address */
	function closeRequest(bytes32 requestId) public {
		MergeRequest storage request = requests[requestId];
		/** Check the msg.sender is an approved address */
		require(isApproved(request, msg.sender) > 0, "msg.sender not an approved address");
		request.status = 0;
	}

	function executeRequest(bytes32 requestId) public {
		MergeRequest storage request = requests[requestId];

		/** Check the msg.sender is an approved address */
		require(isApproved(request, msg.sender) > 0, "msg.sender not an approved address");

		uint256[] memory indexes = new uint256[](request.headUpdates.length);
		for (uint256 ix = 0; ix < request.headUpdates.length; ix++) {
			indexes[ix] = ix;
		}

		executeRequestPartiallyInternal(requestId, indexes, msg.sender);
	}

	function executeRequestPartially(bytes32 requestId, uint256[] memory indexes) public {
		executeRequestPartiallyInternal(requestId, indexes, msg.sender);
	}

	function executeRequestPartiallyInternal(
		bytes32 requestId,
		uint256[] memory indexes,
		address msgSender) private {

		MergeRequest storage request = requests[requestId];
		require(request.authorized != 0, "Request not authorized");

		require(isApproved(request, msgSender) > 0, "msg.sender not an approved address");

		for (uint256 ix = 0; ix < indexes.length; ix++) {
			HeadUpdate storage headUpdate = request.headUpdates[indexes[ix]];

			require(headUpdate.executed == 0, "head update already executed");

			/** mark the update as executed */
			headUpdate.executed = 1;
			/** Update the head */
			updateHead(headUpdate.perspectiveIdHash, headUpdate.headId);
		}
	}

	/** Get the perspective owner and head from its ID */
	function getRequest(bytes32 batchId)
		public view
		returns(MergeRequest memory batch) {
		return (requests[batchId]);
	}

}
