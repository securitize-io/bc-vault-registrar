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

pragma solidity ^0.8.22;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IVaultWhitelister} from "../IVaultWhitelister.sol";
import "./MockVault.sol";

/// @title MockDeFiProtocol - Test DeFi protocol that manages vaults per investor
contract MockDeFiProtocol {
    IVaultWhitelister public vaultWhitelister;
    IERC20 public dsToken;
    mapping(address => address) public investorVaults;

    event VaultCreated(address indexed investor, address indexed vault);
    event Deposit(address indexed investor, address indexed vault, uint256 amount);

    constructor(address _vaultWhitelister, address _dsToken) {
        vaultWhitelister = IVaultWhitelister(_vaultWhitelister);
        dsToken = IERC20(_dsToken);
    }

    /**
     * @dev Deposits DSTokens for the caller (msg.sender)
     * @param amount The amount of tokens to deposit
     */
    function deposit(uint256 amount) external {
        address vault = investorVaults[msg.sender];

        if (vault == address(0)) {
            // Deploy new vault and whitelist
            vault = deployVault();
            investorVaults[msg.sender] = vault;
            // MockDeFiProtocol debe tener OPERATOR_ROLE para llamar whitelist()
            vaultWhitelister.whitelist(vault, msg.sender);
            emit VaultCreated(msg.sender, vault);
        }

        // Transfer tokens desde la wallet del inversor (msg.sender) hacia el vault
        // El inversor debe haber hecho approve() primero
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
}
