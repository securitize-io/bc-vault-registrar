/**
 * Copyright 2026 Securitize Inc. All rights reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IVaultRegistrar} from "../IVaultRegistrar.sol";
import "./MockVault.sol";

/// @title MockDeFiProtocol - Test DeFi protocol that manages vaults per investor
contract MockDeFiProtocol {
    IVaultRegistrar public vaultRegistrar;
    IERC20 public dsToken;
    mapping(address => address) public investorVaults;

    event VaultCreated(address indexed investor, address indexed vault);
    event Deposit(address indexed investor, address indexed vault, uint256 amount);
    event Withdraw(address indexed investor, address indexed vault, uint256 amount);

    constructor(address _vaultRegistrar, address _dsToken) {
        vaultRegistrar = IVaultRegistrar(_vaultRegistrar);
        dsToken = IERC20(_dsToken);
    }

    /**
     * @dev Deposits DSTokens for the caller (msg.sender)
     * @param amount The amount of tokens to deposit
     * @param deadline Unix timestamp after which the investor signature is invalid
     * @param signature EIP-712 investor signature authorizing vault registration
     */
    function deposit(uint256 amount, uint256 deadline, bytes calldata signature) external {
        address vault = investorVaults[msg.sender];

        if (vault == address(0)) {
            vault = deployVault();
            investorVaults[msg.sender] = vault;
            vaultRegistrar.registerVaultWithSig(vault, msg.sender, deadline, signature);
            emit VaultCreated(msg.sender, vault);
        }

        dsToken.transferFrom(msg.sender, vault, amount);
        emit Deposit(msg.sender, vault, amount);
    }

    /**
     * @dev Deploys a new MockVault contract
     * @return The address of the deployed vault
     */
    function deployVault() internal returns (address) {
        MockVault vault = new MockVault();
        return address(vault);
    }

    /**
     * @dev Clears the vault mapping for a specific investor address
     * @param investor The investor address to clear
     * @notice Useful for testing to reset state
     */
    function clearVault(address investor) external {
        delete investorVaults[investor];
    }

    /**
     * @dev Clears the vault mapping for the caller (msg.sender)
     * @notice Useful for testing to reset state
     */
    function clearMyVault() external {
        delete investorVaults[msg.sender];
    }

    /**
     * @dev Withdraws DSTokens from the vault back to the caller (msg.sender)
     * @param amount The amount of tokens to withdraw
     */
    function withdraw(uint256 amount) external {
        address vault = investorVaults[msg.sender];
        if (vault == address(0)) {
            revert("Vault does not exist");
        }

        MockVault(vault).withdraw(address(dsToken), msg.sender, amount);
        emit Withdraw(msg.sender, vault, amount);
    }
}
