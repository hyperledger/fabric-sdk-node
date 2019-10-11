/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

export enum Constants {
	// Timeouts and steps
	HUGE_TIME  = 1200000,
	INC_LONG   = 30000,
	INC_MED    = 10000,
	INC_SHORT  = 5000,
	STEP_LONG  = 240000,
	STEP_MED   = 120000,
	STEP_SHORT = 60000,

	INSTALL_TIMEOUT = 120000,
	INSTANTIATE_TIMEOUT = 300000,

	// Fabric state
	FABRIC_STATE = 'FABRIC_STATE',

	// Known channels
	CREATED_CHANNELS = 'CREATED_CHANNELS',
	JOINED_CHANNELS = 'JOINT_CHANNELS',

	// Installed smart contracts
	INSTALLED_SC = 'INSTALLED_SC',
	INSTANTIATED_SC = 'INSTANTIATED_SC',

	// Default container for use in certain CLI actions
	DEFAULT_CLI_CONTAINER = 'org1',

	// Default Org for testing
	DEFAULT_ORG = 'Org1',

	// CLI command versosity (true/false)
	CLI_VERBOSITY = 'false',

	// Constants for network model actions
	WALLET = 'wallet',		// StateStore key to retrieve a wallet that contains users
	GATEWAYS = 'gateways',	// StateStore key to retrieve a Map(gatewayName, Gateway) of gateways that may be re-used
}
