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

import {Errors} from "./Errors.sol";

/**
 * @title IWhitelister
 * @dev Interface for the Whitelister contract
 */
interface IWhitelister is Errors {
    /**
     * @dev Emitted when a vault is whitelisted under an investor identity
     * @param investor The investor wallet address
     * @param vault The vault address that was whitelisted
     * @param dsToken The DSToken address
     * @param investorId The investor ID
     */
    event Whitelisted(address indexed investor, address indexed vault, address indexed dsToken, string investorId);

    /**
     * @dev Whitelists a vault address under an existing investor identity
     * @param vaultAddress The vault address to whitelist
     * @param investorWalletAddress The investor's wallet address
     * @custom:selector 0xb092145e
     */
    function whitelist(address vaultAddress, address investorWalletAddress) external;

    /**
     * @dev Returns the DSToken address
     * @return The DSToken address
     * @custom:selector 0x69eb0b1b
     */
    function dsToken() external view returns (address);
}
