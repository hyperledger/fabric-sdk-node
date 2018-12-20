#
# SPDX-License-Identifier: Apache-2.0
#

@discovery
@clean-gateway
Feature: Configure Fabric using SDK using discovery service and submit/evaluate using a network Gateway

	Background:
		Given I have forcibly taken down all docker containers
		And I have disconnected from all gateways

 	Scenario: Using a Gateway I can submit and evaluate transactions on instantiated chaincode
		Given I have deployed a tls Fabric network
		Then I can create and join all channels from the tls common connection profile
		And I can update channel with name mychannel with config file ../../config/crypto-config/mychannel-org1anchor.tx from the tls common connection profile
		And I can install/instantiate node chaincode at version 1.0.0 named marbles to the tls Fabric network for all organizations on channel mychannel with endorsement policy 1AdminOr2Other and args [init,a,1000,b,2000]
		And I can create a gateway named discovery_gateway as user User1 within Org1 using the discovery common connection profile
	 	And I use the gateway named discovery_gateway to submit a transaction with args [initMarble,marble1,blue,35,tom] for chaincode marbles instantiated on channel mychannel
		And I use the gateway named discovery_gateway to evaluate transaction with args [readMarble,marble1] for chaincode marbles instantiated on channel mychannel with the response matching {"color":"blue","docType":"marble","name":"marble1","owner":"tom","size":35}
		And I can disconnect from the gateway named discovery_gateway
