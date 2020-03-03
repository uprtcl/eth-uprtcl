pragma solidity >=0.5.0 <0.6.0;
pragma experimental ABIEncoderV2;

import "./UprtclRoot.sol";
import "./Ownable.sol";

contract UPNService is Ownable {

    struct UPRParts {
        string context;
        string upn;
    }

    mapping(bytes32 => address) upns;
    mapping(bytes32 => string) uprs;

    uint[16] regFees;
    uint[16] trfFees;

    UprtclRoot uprtclRoot;

    function setUprtclRoot(UprtclRoot _uprtclRoot) public onlyOwner {
        uprtclRoot = _uprtclRoot;
    }

    function getRegFee(uint len) public view returns(uint fee) {
        for (uint256 ix = 15; ix >= 0; ix--) {
            if (len > ix) {
                return regFees[ix];
            }
        }
    }

    function getTrfFee(uint len) public view returns(uint fee) {
        for (uint256 ix = 15; ix >= 0; ix--) {
            if (len > ix) {
                return trfFees[ix];
            }
        }
    }

    function setRegFees(uint[16] calldata fees) external onlyOwner {
        for (uint256 ix = 0; ix < 16; ix++) {
            regFees[ix] = fees[ix];
        }
    }

    function setTrfFees(uint[16] calldata fees) external onlyOwner {
        for (uint256 ix = 0; ix < 16; ix++) {
            trfFees[ix] = fees[ix];
        }
    }

    function hashUpn(string memory upn) public pure returns(bytes32 upnHased) {
        return keccak256(abi.encode(upn));
    }

    function registerUPN(string calldata upn, address owner, address account) external {
        bytes32 upnHash = hashUpn(upn);
        require(upns[upnHash] == address(0), "UPN not available");
        
        uint len = strlen(upn);
        require(len > 0, "string cant be empty");
        
        uint fee = getRegFee(len);
        
        if (fee > 0) {
            uprtclRoot.consume(account, msg.sender, fee);
        }

        upns[upnHash] = owner;
    }

    function getUPN(bytes32 upnHash) public view returns(address owner) {
        return upns[upnHash];
    }

    function transferUPN(string calldata upn, address newOwner, address account) external {
        bytes32 upnHash = hashUpn(upn);
        require(upns[upnHash] == msg.sender, "UPN not owned by msg.sender");

        uint len = strlen(upn);
        uint fee = getTrfFee(len);
        
        if (fee > 0) {
            uprtclRoot.consume(account, msg.sender, fee);
        }

        upns[upnHash] = newOwner;
    }

    function hashUpr(string memory context, string memory upn) public pure returns(bytes32 uprHased) {
        return keccak256(abi.encode(context, upn));
    }

    function setUPRInternal(UPRParts memory uprParts, string memory value) private {
        bytes32 uprHash = hashUpr(uprParts.context, uprParts.upn);
        uprs[uprHash] = value;
    }

    function setUPR(UPRParts memory uprParts, string memory value) public {
        bytes32 upnHash = hashUpn(uprParts.upn);
        require(upns[upnHash] == msg.sender, "UPN not owned by msg.sender");
        setUPRInternal(uprParts, value);
    }

    function getUPR(bytes32 uprHash) public view returns (string memory value) {
        return uprs[uprHash];
    }

    function strlen(string memory s) internal pure returns (uint) {
        s; // Don't warn about unused variables
        // Starting here means the LSB will be the byte we care about
        uint ptr;
        uint end;
        assembly {
            ptr := add(s, 1)
            end := add(mload(s), ptr)
        }
        uint len = 0;
        for (len; ptr < end; len++) {
            uint8 b;
            assembly { b := and(mload(ptr), 0xFF) }
            if (b < 0x80) {
                ptr += 1;
            } else if (b < 0xE0) {
                ptr += 2;
            } else if (b < 0xF0) {
                ptr += 3;
            } else if (b < 0xF8) {
                ptr += 4;
            } else if (b < 0xFC) {
                ptr += 5;
            } else {
                ptr += 6;
            }
        }
        return len;
    }

}