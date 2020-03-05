pragma solidity >=0.5.0 <0.6.0;
pragma experimental ABIEncoderV2;

import "./UprtclRoot.sol";
import "./Ownable.sol";
import "./SafeMath.sol";

contract UPNService is Ownable {
    
    using SafeMath for uint256;

    struct UPNIn {
        address owner;
        uint256 V;
        uint256 P;
    }

    struct UPN {
        address owner;
        uint256 V;
        uint256 P;
        uint256 block0;
        uint256 paid;

        uint8 taken;
        address newOwner;
        uint256 blockAvailable;
        uint256 newV;
        uint256 newP;
    }

    struct UPRParts {
        string context;
        string upn;
    }

    mapping(bytes32 => UPN) upns;
    mapping(bytes32 => string) uprs;

    uint256 public Fi;
    uint256 public Ri;
    uint256 public Qi;
    uint256 public P_BLOCKS;

    uint256 public DECIMALS = 1000000;

    UprtclRoot uprtclRoot;

    function setUprtclRoot(UprtclRoot _uprtclRoot) public onlyOwner {
        uprtclRoot = _uprtclRoot;
    }

    function setFi(uint256 newValue) public onlyOwner { Fi = newValue; }
    function setRi(uint256 newValue) public onlyOwner { Ri = newValue; }
    function setQ(uint256 newValue) public onlyOwner { Qi = newValue; }
    function setP_BLOCKS(uint256 newValue) public onlyOwner { P_BLOCKS = newValue; }

    function hashUpn(string memory upn) public pure returns(bytes32 upnHased) {
        return keccak256(abi.encode(upn));
    }

    function getTaxPerBlock(uint256 V, uint256 P) public view returns(uint256 price) {
        return V.mul(Ri).div(DECIMALS).add((Qi.mul(P).mul(P).div(DECIMALS)));
    }

    function registerUPN(string calldata upnName, UPNIn calldata upnIn, address account, uint256 upfront) external {
        bytes32 upnHash = hashUpn(upnName);
        UPN storage upn = upns[upnHash];
        require(upn.owner == address(0), "upn not available");

        /** new registration */
        if (upfront > 0) {
            uprtclRoot.consume(account, msg.sender, upfront);
            upn.block0 = block.number;
            upn.paid = upfront;
        }

        upn.owner = upnIn.owner;
        upn.V = upnIn.V;
        upn.P = upnIn.P;
    }

    function chargeUPN(bytes32 upnHash, address account, uint256 amount) external {
        UPN storage upn = upns[upnHash];
        require(upn.owner != address(0), "upn not registered");

        /** new registration */
        uprtclRoot.consume(account, msg.sender, amount);
        upn.paid = upn.paid + amount;
    }

    function transferUPN(bytes32 upnHash, address newOwner) external {
        UPN storage upn = upns[upnHash];
        require(upn.owner == msg.sender, "upn can only be updated by its current owner");
        upn.owner = newOwner;
    }

    function editUPN(bytes32 upnHash, uint256 V, uint256 P, address account, uint256 upfront) external {
        UPN storage upn = upns[upnHash];
        require(upn.owner == msg.sender, "upn can only be updated by its current owner");

        /** send unpaid balance back ot owner */
        uint256 shouldHavePaid = getTaxPerBlock(upn.V, upn.P).mul(block.number - upn.block0);
        uprtclRoot.transferTo(account, msg.sender, upn.owner, upn.paid.sub(shouldHavePaid));

        /** consume new upfront payment */
        uprtclRoot.consume(account, msg.sender, upfront);
        upn.block0 = block.number;
        upn.paid = upfront;
        upn.V = V;
        upn.P = P;
    }

    function takeUnpaidUPN(bytes32 upnHash, UPNIn calldata upnIn, address account, uint256 upfront) external {
        UPN storage upn = upns[upnHash];
        uint256 shouldHavePaid = getTaxPerBlock(upn.V, upn.P).mul(block.number - upn.block0);
        require(shouldHavePaid > upn.paid, "UPN is uptodate on payments");

        /** reset payment status */
        uprtclRoot.consume(account, msg.sender, upfront);
        upn.block0 = block.number;
        upn.paid = upfront;

        /** if taken, only the new owner can take it */
        if (upn.taken > 0) {
            upn.owner = upn.newOwner;
            upn.V = upn.newV;
            upn.P = upn.newP;

            upn.taken = 0;
            upn.newOwner = address(0);
            upn.newV = 0;
            upn.newP = 0;
        } else {
            upn.owner = upnIn.owner;
            upn.V = upnIn.V;
            upn.P = upnIn.P;
        }
    }

    function takeUPN(bytes32 upnHash, UPNIn calldata upnIn, address account) external {
        UPN storage upn = upns[upnHash];
        require(upn.owner != address(0), "upn not registered");
        require(upn.taken == 0, "upn already taken");

        uint256 payUs = upn.V.mul(Fi).div(DECIMALS);
        uint256 payOwner = upn.V.sub(payUs);

        uprtclRoot.transferTo(account, msg.sender, upn.owner, payOwner);
        uprtclRoot.consume(account, msg.sender, payUs);

        upn.taken = 1;
        upn.newOwner = upnIn.owner;
        upn.newV = upnIn.V;
        upn.newP = upnIn.P;

        uint256 Pb = upn.P.mul(P_BLOCKS);
        upn.blockAvailable = block.number.add(Pb);
    }

    function executeTake(bytes32 upnHash) external {
        UPN storage upn = upns[upnHash];
        require(upn.taken == 1, "upn not previously taken");
        require(block.number >= upn.blockAvailable, "upn still under protection period");

        upn.owner = upn.newOwner;
        upn.V = upn.newV;
        upn.P = upn.newP;

        upn.taken = 0;
        upn.newOwner = address(0);
        upn.newV = 0;
        upn.newP = 0;
    }

    function getUPN(bytes32 upnHash) public view returns(UPN memory upn) {
        return upns[upnHash];
    }

    function hashUpr(string memory context, string memory upn) public pure returns(bytes32 uprHashed) {
        return keccak256(abi.encode(context, upn));
    }

    function setUPRInternal(UPRParts memory uprParts, string memory value) private {
        bytes32 uprHash = hashUpr(uprParts.context, uprParts.upn);
        uprs[uprHash] = value;
    }

    function setUPR(UPRParts memory uprParts, string memory value) public {
        bytes32 upnHash = hashUpn(uprParts.upn);
        require(upns[upnHash].owner == msg.sender, "UPN not owned by msg.sender");
        setUPRInternal(uprParts, value);
    }

    function getUPR(bytes32 uprHash) public view returns (string memory value) {
        return uprs[uprHash];
    }

}