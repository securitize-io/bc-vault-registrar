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

import {BaseVaultWhitelister} from "./BaseVaultWhitelister.sol";
import {IVaultWhitelister} from "./IVaultWhitelister.sol";
import {IDSServiceConsumer} from "./interfaces/IDSServiceConsumer.sol";
import {IDSRegistryService} from "./interfaces/IDSRegistryService.sol";

/**
 * @title VaultWhitelister
 * @dev Allows authorized DeFi protocols to whitelist vault addresses under existing investor identities
 */
contract VaultWhitelister is IVaultWhitelister, BaseVaultWhitelister {
    /// @dev The DSToken address this whitelister is associated with
    address public dsToken;

    /// @dev Storage gap for future upgrades
    uint256[49] private __gap;

    /**
     * @dev Initializes the contract
     * @param _dsToken The DSToken address
     */
    function initialize(address _dsToken) public initializer {
        if (_dsToken == address(0)) revert InvalidAddress();

        __BaseVaultWhitelister_init();

        dsToken = _dsToken;
    }

    /**
     * @dev Whitelists a vault address under an existing investor identity
     * @param vaultAddress The vault address to whitelist
     * @param investorWalletAddress The investor's wallet address
     */
    function whitelist(
        address vaultAddress,
        address investorWalletAddress
    ) external whenNotPaused onlyAdminOrOperator notZeroAddress(vaultAddress) notZeroAddress(investorWalletAddress) {
        // Get Registry Service
        IDSRegistryService registryService = IDSRegistryService(
            IDSServiceConsumer(dsToken).getDSService(REGISTRY_SERVICE)
        );

        // Get investor ID from the investor wallet
        string memory investorId = registryService.getInvestor(investorWalletAddress);
        if (bytes(investorId).length == 0) {
            revert InvestorNotFound(investorWalletAddress);
        }

        // Check if vault is already registered
        if (registryService.isWallet(vaultAddress)) {
            revert VaultAlreadyRegistered(vaultAddress);
        }

        // Check investor wallet has balance > 0
        if (IERC20(dsToken).balanceOf(investorWalletAddress) == 0) {
            revert InvestorHasNoBalance(investorWalletAddress);
        }

        // Register the vault under the investor identity
        registryService.addWallet(vaultAddress, investorId);

        emit VaultWhitelisted(investorWalletAddress, vaultAddress, dsToken, investorId);
    }
}
