pragma solidity >=0.5.0 <0.6.0;
pragma experimental ABIEncoderV2;

import "./UprtclRoot.sol";
import "./UPRRegistry.sol";
import "./Ownable.sol";
import "./SafeMath.sol";

contract UPNService is Ownable {
    
    using SafeMath for uint256;

    struct UPNIn {
        address owner;
        uint256 V;
        uint256 P;
        UPRRegistry registry;
    }

    struct UPN {
        address owner;
        uint256 V;
        uint256 P;
        uint256 block0;
        uint256 paid;
        UPRRegistry registry;

        uint8 taken;
        address newOwner;
        uint256 blockAvailable;
        uint256 newV;
        uint256 newP;
        UPRRegistry newRegistry;
    }

    mapping(bytes32 => UPN) upns;
    
    uint256 public Fi;
    uint256 public Ri;
    uint256 public Q;
    uint256 public P_BLOCKS;
    uint256 public P_PER_YEAR;

    uint256 public DECIMALS = 1000000;

    UprtclRoot uprtclRoot;

    function setUprtclRoot(UprtclRoot _uprtclRoot) public onlyOwner {
        uprtclRoot = _uprtclRoot;
    }

    function setFi(uint256 nv) public onlyOwner { Fi = nv; }
    function setRi(uint256 nv) public onlyOwner { Ri = nv; }
    function setQ(uint256 nv) public onlyOwner { Q = nv; }
    function setP_BLOCKS(uint256 nv) public onlyOwner { P_BLOCKS = nv; }
    function setP_PER_YEAR(uint256 nv) public onlyOwner { P_PER_YEAR = nv; }

    function hashUpn(string memory upn) public pure returns(bytes32 upnHased) {
        return keccak256(abi.encode(upn));
    }

    function getTaxPerYear(uint256 V, uint256 P) public view returns(uint256 yearlyTax) {
        return V.mul(Ri).div(DECIMALS).add((Q.mul(P).div(P_BLOCKS).mul(P).div(P_BLOCKS)));
    }

    function getTaxPerBlock(uint256 V, uint256 P) public view returns(uint256 perBlockTax) {
        return getTaxPerYear(V, P).div(P_PER_YEAR).div(P_BLOCKS);
    }

    function registerUPN(string calldata upnName, UPNIn calldata upnIn, address account, uint256 upfront) external {
        bytes32 upnHash = hashUpn(upnName);
        UPN storage upn = upns[upnHash];
        require(upn.owner == address(0), "upn not available");

        /** new registration */
        if (upfront > 0) {
            uprtclRoot.consume(account, msg.sender, upfront);
        }

        upn.block0 = block.number;
        upn.paid = upfront;

        upn.owner = upnIn.owner;
        upn.V = upnIn.V;
        upn.P = upnIn.P;
        upn.registry = upnIn.registry;
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
        require(upn.taken == 0, "taken upns cant be edited");

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

    function changeUPRRegistry(bytes32 upnHash, UPRRegistry registry) external {
        UPN storage upn = upns[upnHash];
        require(upn.owner == msg.sender, "upn can only be updated by its current owner");
        require(upn.taken == 0, "taken upns cant be edited");

        upn.registry = registry;
    }

    function takeUnpaidUPN(bytes32 upnHash, UPNIn calldata upnIn, address account, uint256 upfront) external {
        UPN storage upn = upns[upnHash];
        uint256 shouldHavePaid = getTaxPerBlock(upn.V, upn.P).mul(block.number - upn.block0);
        require(shouldHavePaid > upn.paid, "UPN is up-to-date on payments");

        /** reset payment status */
        if (upfront > 0) {
            uprtclRoot.consume(account, msg.sender, upfront);
        }

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
            // upn.newRegistry = address(0);
        } else {
            upn.owner = upnIn.owner;
            upn.V = upnIn.V;
            upn.P = upnIn.P;
            upn.registry = upnIn.registry;
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
        upn.newRegistry = upnIn.registry;
        upn.blockAvailable = block.number.add(upn.P);
    }

    function executeTake(bytes32 upnHash) external {
        UPN storage upn = upns[upnHash];
        require(upn.taken == 1, "upn not previously taken");
        require(block.number >= upn.blockAvailable, "upn still under protection period");

        upn.owner = upn.newOwner;
        upn.V = upn.newV;
        upn.P = upn.newP;
        upn.registry = upn.newRegistry;

        upn.taken = 0;
        upn.newOwner = address(0);
        upn.newV = 0;
        upn.newP = 0;
        // upn.newRegistry = address(0);
    }

    function getUPN(bytes32 upnHash) public view returns(UPN memory upn) {
        return upns[upnHash];
    }

    function hashContext(string memory context) public pure returns(bytes32 uprHashed) {
        return keccak256(abi.encode(context));
    }

    function getUPR(bytes32 contextHash, bytes32 upnHash) public view returns (string memory value) {
        UPN storage upn = upns[upnHash];
        return upn.registry.getUPR(contextHash);
    }

}