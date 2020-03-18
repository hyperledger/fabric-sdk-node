#
# SPDX-License-Identifier: Apache-2.0
#

@networkAPI
@clean-gateway
Feature: Configure Fabric using SDK and submit/evaluate using a network Gateway

	Background:
		Given I have forcibly taken down all docker containers
		And I have disconnected from all gateways
		Given I have deployed a tls Fabric network
		And I can create and join all channels from the tls common connection profile
		Given I can update to an anchored common connection profile channel named mychannel

 	Scenario: Using a Gateway I can submit and evaluate transactions on instantiated chaincode
		Given I can install/instantiate node chaincode at version 1.0.0 named marbles to the tls Fabric network for all organizations on channel mychannel with endorsement policy 1AdminOr2Other and args [init,a,1000,b,2000]
		Then I can create a non-discovery gateway named test_gateway as user User1 within Org1 using the tls common connection profile
	 	And I use the gateway named test_gateway to submit a transaction with args [initMarble,marble1,blue,35,tom] for chaincode marbles instantiated on channel mychannel
		And I use the gateway named test_gateway to evaluate transaction with args [readMarble,marble1] for chaincode marbles instantiated on channel mychannel with the response matching {"color":"blue","docType":"marble","name":"marble1","owner":"tom","size":35}
		And I can disconnect from the gateway named test_gateway
		Given I can install and instantiate node chaincode at version 1.0.0 named marbles to channel mychannel with collection org1 as mymarbles with endorsement policy 1ofAny and args [init,a,1000,b,2000]
		Then I can sleep 10000
		Then I can create a discovery gateway named test_gateway as user User1 within Org1 using the tls common connection profile
	 	And I use the gateway named test_gateway to submit a transaction with args [initMarble,marble1,blue,35,tom] using chaincode mymarbles in collection org1 on channel mychannel
		And I use the gateway named test_gateway to evaluate transaction with args [readMarble,marble1] for chaincode mymarbles instantiated on channel mychannel with the response matching {"color":"blue","docType":"marble","name":"marble1","owner":"tom","size":35}
		And I can disconnect from the gateway named test_gateway