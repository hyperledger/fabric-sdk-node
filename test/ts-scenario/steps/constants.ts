/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

// State store items (just in case you don't want to look at the code)
// - Users Map<userName: string, user: User>

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
	LIB_TO_TEMP = '../../../temp',
	STEPS_TO_POLICIES= '../config/policies.json',
	UTIL_TO_CONFIG = '../../../config',

	GO_PATH= '../../../ts-fixtures/chaincode/goLang/',
	GO_PRE_PEND = 'github.com',

	// Features run
	FEATURES = 'FEATURES',

	// Fabric state
	FABRIC_STATE = 'FABRIC_STATE',

	// Known channels
	CREATED_CHANNELS = 'CREATED_CHANNELS',
	UPDATED_CHANNELS = 'UPDATED_CHANNELS',

	// Instantiated smart contracts
	CONTRACTS  = 'CONTRACTS',

	// Default container for use in certain CLI actions
	DEFAULT_CLI_CONTAINER = 'org1',

	// Default Org for testing
	DEFAULT_ORG = 'Org1',

	// CLI command verbosity (true/false)
	CLI_VERBOSITY = 'false',
	CLI_TIMEOUT = '240s',

	// State store items
	WALLET = 'WALLET',				// StateStore key to retrieve a wallet that contains users
	GATEWAYS = 'GATEWAYS',			// StateStore key to retrieve a Map<gatewayName: string, GatewayObject> of gateways that may be re-used
	LISTENERS = 'LISTENERS',
	TRANSACTIONS = 'TRANSACTIONS',
	CLIENTS = 'CLIENTS', 				// Map<clientName: string, { client: Client, user: User, ccp: CommonConnectionProfileHelper, clientOrg: string, channels: Map<channelName: string, channel: Channel> } >

	// Wallet types
	MEMORY_WALLET = 'memory',
	FILE_WALLET = 'file',
	COUCH_WALLET = 'couchDB',
	COUCH_WALLET_URL = 'http://admin:adminpw@localhost:5984',
	HSM_WALLET = 'HSM',

	// provider types
	HSM_PROVIDER = 'HSM-X.509',
	X509_PROVIDER = 'X.509',

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

	// CLI paths
	CLI_ORG1_PEER_ADDRESS = 'peer0.org1.example.com:7051',
	CLI_ORG2_PEER_ADDRESS = 'peer0.org2.example.com:8051',
	CLI_ORDERER_CA_FILE = '/etc/hyperledger/configtx/crypto-config/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem',
	CLI_ORG1_CA_FILE = '/etc/hyperledger/config/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt',
	CLI_ORG2_CA_FILE = '/etc/hyperledger/config/crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt',

	// CLI Policies
	ENDORSEMENT_POLICY_1OF_ANY = '"OR (\'Org1MSP.member\',\'Org2MSP.member\')"',
	ENDORSEMENT_POLICY_2OF_ANY = '"AND (\'Org1MSP.member\',\'Org2MSP.member\')"',

	// Admin name
	ADMIN_NAME = 'admin',
	ADMIN_PW = 'adminpw',

	// Default Naming
	EVENT_HUB_DEFAULT_NAME = 'myHub',
}
