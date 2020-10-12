pragma solidity >=0.5.0 <0.6.0;

import "./HasSuperUsers.sol";
import "./IERC20.sol";

contract UprtclAccounts is HasSuperUsers {
    mapping(address => mapping(address => bool)) public accounts;

    IERC20 public token;

    function setToken(IERC20 _token) public onlyOwner {
        token = _token;
    }

    function setUsufructuary(address usufructuary, bool value) public {
        accounts[msg.sender][usufructuary] = value;
    }

    function isUsufructuary(address account, address usufructuary)
        public
        view
        returns (bool itIs)
    {
        return accounts[account][usufructuary];
    }

    function transfer(address to, uint256 amount) public onlyOwner {
        token.transfer(to, amount);
    }

    function consume(
        address account,
        address by,
        uint256 amount
    ) public onlySuperUser {
        require(
            isUsufructuary(account, by) == true,
            "user is not an account usufructuary"
        );
        token.transferFrom(account, address(this), amount);
    }

    function transferTo(
        address account,
        address by,
        address to,
        uint256 amount
    ) public onlyOwner {
        require(
            isUsufructuary(account, by) == true,
            "user is not an account usufructuary"
        );
        token.transferFrom(account, to, amount);
    }
}
