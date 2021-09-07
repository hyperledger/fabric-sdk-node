/**
 * SPDX-License-Identifier: Apache-2.0
 */

// State store items (just in case you don't want to look at the code)
// - Users Map<userName: string, user: User>

// Timeouts and steps
export const HUGE_TIME  = 1200000;
export const INC_LONG   = 30000;
export const INC_MED    = 10000;
export const INC_SHORT  = 5000;
export const INC_TINY   = 1000;
export const STEP_LONG  = 240000;
export const STEP_MED   = 120000;
export const STEP_SHORT = 60000;

export const INSTALL_TIMEOUT = 120000;
export const INSTANTIATE_TIMEOUT = 300000;

// Paths
export const LIB_TO_CONFIG = '../../config';
export const LIB_TO_CHAINCODE = '../../../ts-fixtures/chaincode';
export const LIB_TO_POLICIES = '../../config/policies.json';
export const LIB_TO_TEMP = '../../../temp';
export const STEPS_TO_POLICIES = '../config/policies.json';
export const UTIL_TO_CONFIG = '../../../config';

export const GO_PATH = '../../../ts-fixtures/chaincode/goLang/';
export const GO_PRE_PEND = 'github.com';

// Features run
export const FEATURES = 'FEATURES';

// Fabric state
export const FABRIC_STATE = 'FABRIC_STATE';

// Known channels
export const CREATED_CHANNELS = 'CREATED_CHANNELS';
export const UPDATED_CHANNELS = 'UPDATED_CHANNELS';

// Instantiated smart contracts
export const CONTRACTS  = 'CONTRACTS';

// Default container for use in certain CLI actions
export const DEFAULT_CLI_CONTAINER = 'org1';

// Default Org for testing
export const DEFAULT_ORG = 'Org1';

// CLI command verbosity (true/false)
export const CLI_VERBOSITY = 'false';
export const CLI_TIMEOUT = '240s';

// State store items
export const WALLET = 'WALLET';				// StateStore key to retrieve a wallet that contains users
export const GATEWAYS = 'GATEWAYS';			// StateStore key to retrieve a Map<gatewayName: string; GatewayObject> of gateways that may be re-used
export const LISTENERS = 'LISTENERS';
export const TRANSACTIONS = 'TRANSACTIONS';
export const CLIENTS = 'CLIENTS'; 				// Map<clientName: string; { client: Client; user: User; ccp: CommonConnectionProfileHelper; clientOrg: string; channels: Map<channelName: string; channel: Channel> } >

// Wallet types
export const MEMORY_WALLET = 'memory';
export const FILE_WALLET = 'file';
export const COUCH_WALLET = 'couchDB';
export const COUCH_WALLET_URL = 'http://admin:adminpw@localhost:5984';
export const HSM_WALLET = 'HSM';

// provider types
export const HSM_PROVIDER = 'HSM-X.509';
export const X509_PROVIDER = 'X.509';

// Listener types
export const CONTRACT = 'CONTRACT';
export const BLOCK    = 'BLOCK';
export const TRANSACTION = 'TRANSACTION';

// Proposal types
export const APPROVE = 'APPROVE';
export const COMMIT = 'COMMIT';
export const SUBMIT = 'SUBMIT';

// Comparing
export const EXACT = 'EXACT';
export const GREATER_THAN = 'GREATER_THAN';
export const LESS_THAN = 'LESS_THAN';

// CLI paths
export const CLI_ORG1_PEER_ADDRESS = 'peer0.org1.example.com:7051';
export const CLI_ORG2_PEER_ADDRESS = 'peer0.org2.example.com:8051';
export const CLI_ORDERER_CA_FILE = '/etc/hyperledger/configtx/crypto-config/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem';
export const CLI_ORG1_CA_FILE = '/etc/hyperledger/config/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt';
export const CLI_ORG2_CA_FILE = '/etc/hyperledger/config/crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt';

// CLI Policies
export const ENDORSEMENT_POLICY_1OF_ANY = '"OR (\'Org1MSP.member\';\'Org2MSP.member\')"';
export const ENDORSEMENT_POLICY_2OF_ANY = '"AND (\'Org1MSP.member\';\'Org2MSP.member\')"';

// Admin name
export const ADMIN_NAME = 'admin';
export const ADMIN_PW = 'adminpw';

// Default Naming
export const EVENT_HUB_DEFAULT_NAME = 'myHub';