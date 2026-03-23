// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FinzoToken
 * @dev Implementation of the Finzo Token (FZ).
 * This is the native utility token for the Finzo ecosystem.
 */
contract FinzoToken is ERC20, ERC20Burnable, Ownable {
    
    // Initial supply: 10,000,000 FZ
    uint256 private constant INITIAL_SUPPLY = 10_000_000 * 10**18;

    constructor(address initialOwner) 
        ERC20("Token Finzo", "FZ") 
        Ownable(initialOwner) 
    {
        _mint(initialOwner, INITIAL_SUPPLY);
    }

    /**
     * @dev Function to mint tokens, only callable by owner.
     * @param to The address that will receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
