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

/**
 * @title IDSRegistryService
 * @dev Interface for the Securitize Registry Service
 */
interface IDSRegistryService {
    /**
     * @dev Gets the investor ID for a wallet address
     * @param _address The wallet address
     * @return The investor ID (empty string if not registered)
     */
    function getInvestor(address _address) external view returns (string memory);

    /**
     * @dev Adds a wallet to an investor
     * @param _address The wallet address to add
     * @param _id The investor ID
     * @return True if successful
     */
    function addWallet(address _address, string memory _id) external returns (bool);
}
