pragma solidity >=0.5.0 <0.6.0;
pragma experimental ABIEncoderV2;

import "./Ownable.sol";
import "./SafeMath.sol";

import "./UprtclAccounts.sol";

/** A simple signaling contract purposely designed for _Prtcl evees */
contract UprtclRoot is HasSuperUsers {
    using SafeMath for uint256;

    uint256 public fee;
    UprtclAccounts public accounts;

    event HeadUpdated(address indexed owner, bytes32 val1, bytes32 val0);

    function setAccounts(UprtclAccounts _accounts) external onlyOwner {
        accounts = _accounts;
    }

    function withdraw(uint256 amount) external onlyOwner {
        this.owner().transfer(amount);
    }

    function setFee(uint256 _fee) external onlyOwner {
        fee = _fee;
    }

    function consume(
        address account,
        address by,
        uint256 amount
    ) private {
        accounts.consume(account, by, amount);
    }

    function updateHead(
        bytes32 val1,
        bytes32 val0,
        address account
    ) external {
        if (!isSuperUser(msg.sender)) {
            if (this.fee > 0) {
                accounts.consume(account, msg.sender, fee);
            }
        }
        emit HeadUpdated(msg.sender, val1, val0);
    }
}
