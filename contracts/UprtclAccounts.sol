pragma solidity >=0.5.0 <0.6.0;

import "./Ownable.sol";
import "./IERC20.sol";

contract UprtclAccounts is Ownable {

    mapping(address => mapping(address => bool)) public accounts;

    IERC20 public token;

    function setToken (IERC20 _token) public onlyOwner {
        token = _token;
    }

    function withdraw (address to, uint256 amount) public onlyOwner {
        token.transfer(to, amount);
    }

    function setUsufructuary (address usufructuary, bool value) public {
        accounts[msg.sender][usufructuary] = value;
    }

    function isUsufructuary (address account, address usufructuary) public view returns (bool itIs) {
        return accounts[account][usufructuary];
    }

    function consume (address account, address by, uint256 amount) public {
        // TODO: Should be callable from UprtclRoot or UprtclProposals only!
        require(isUsufructuary(account, by) == true, "user is not an account usufructuary");
        token.transferFrom(account, address(this), amount);
    }

}
