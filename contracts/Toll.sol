pragma solidity >=0.5.0 <0.6.0;

import "./Ownable.sol";
/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
contract Toll is Ownable {

    uint256[2] private fees;

    function withdraw(uint256 amount) public onlyOwner {
        this.owner().transfer(amount);
    }

    function setFees(uint256 addFee, uint256 updateFee) public onlyOwner {
        fees[0] = addFee;
        fees[1] = updateFee;
    }

    function getFees() public view returns (uint256 addFee, uint256 updateFee) {
        return (fees[0], fees[1]);
    }

    function getAddFee() public view returns (uint256) {
        return fees[0];
    }

    function getUpdateFee() public view returns (uint256) {
        return fees[1];
    }
}