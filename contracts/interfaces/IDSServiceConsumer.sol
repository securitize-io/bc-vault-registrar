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
 * @title IDSServiceConsumer
 * @dev Interface for accessing DSToken services
 */
interface IDSServiceConsumer {
    /**
     * @dev Service ID constants
     */
    // uint256 constant TRUST_SERVICE = 1;
    // uint256 constant DS_TOKEN = 2;
    // uint256 constant REGISTRY_SERVICE = 4;

    /**
     * @dev Gets the address of a service by its ID
     * @param _serviceId The ID of the service
     * @return The address of the service
     */
    function getDSService(uint256 _serviceId) external view returns (address);
}
