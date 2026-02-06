/**
 * Copyright 2025 Securitize Inc. All rights reserved.
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

/// @title MockRegistryService - Test registry service for VaultRegistrar
contract MockRegistryService {
    mapping(address => string) private addressToInvestorId;

    event WalletAdded(address indexed wallet, string investorId);

    /// @dev Registers an investor with a wallet
    function registerInvestor(address _wallet, string calldata _investorId) external {
        addressToInvestorId[_wallet] = _investorId;
    }

    /// @dev Gets the investor ID for a wallet
    function getInvestor(address _wallet) external view returns (string memory) {
        return addressToInvestorId[_wallet];
    }

    /// @dev Adds a wallet to an investor (called by VaultRegistrar)
    function addWallet(address _wallet, string memory _investorId) external returns (bool) {
        addressToInvestorId[_wallet] = _investorId;
        emit WalletAdded(_wallet, _investorId);
        return true;
    }
}
