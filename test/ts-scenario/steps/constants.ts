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
	INC_TINY   = 1000,
	STEP_LONG  = 240000,
	STEP_MED   = 120000,
	STEP_SHORT = 60000,

	INSTALL_TIMEOUT = 120000,
	INSTANTIATE_TIMEOUT = 300000,

	// Paths
	LIB_TO_CONFIG = '../../config',
	LIB_TO_CHAINCODE = '../../../ts-fixtures/chaincode',
	LIB_TO_POLICIES = '../../config/policies.json',
	STEPS_TO_POLICIES= '../config/policies.json',

	GO_PATH= '../../../ts-fixtures/chaincode/goLang/',
	GO_PRE_PEND = 'github.com',

	// Features run
	FEATURES = 'FEATURES',

	// Fabric state
	FABRIC_STATE = 'FABRIC_STATE',

	// Known channels
	CREATED_CHANNELS = 'CREATED_CHANNELS',
	JOINED_CHANNELS = 'JOINT_CHANNELS',
	UPDATED_CHANNELS = 'UPDATED_CHANNELS',
	LIFECYCLE_CHANNEL = 'lifecyclechannel',

	// Installed smart contracts
	INSTALLED_SC = 'INSTALLED_SC',
	INSTANTIATED_SC = 'INSTANTIATED_SC',
	CONTRACTS  = 'CONTRACTS',

	// Default container for use in certain CLI actions
	DEFAULT_CLI_CONTAINER = 'org1',

	// Default Org for testing
	DEFAULT_ORG = 'Org1',

	// CLI command verbosity (true/false)
	CLI_VERBOSITY = 'false',

	// Constants for network model actions
	WALLET = 'WALLET',		// StateStore key to retrieve a wallet that contains users
	GATEWAYS = 'GATEWAYS',	// StateStore key to retrieve a Map(gatewayName, Gateway) of gateways that may be re-used
	LISTENERS = 'LISTENERS',
	TRANSACTIONS = 'TRANSACTIONS',

	// Listener types
	CONTRACT = 'CONTRACT',
	BLOCK    = 'BLOCK',
	TRANSACTION = 'TRANSACTION',

	// Proposal types
	APPROVE = 'APPROVE',
	COMMIT = 'COMMIT',
	SUBMIT = 'SUBMIT',

	// Comparing
	EXACT = 'EXACT',
	GREATER_THAN = 'GREATER_THAN',
	LESS_THAN = 'LESS_THAN',

}
