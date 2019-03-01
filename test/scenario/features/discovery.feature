#
# SPDX-License-Identifier: Apache-2.0
#

@discovery
@clean-gateway
Feature: Configure Fabric using SDK using discovery service and submit/evaluate using a network Gateway

	Background:
		Given I have deployed a tls Fabric network
		And I have created and joint all channels from the tls common connection profile
		And I have created a gateway named discovery_gateway as user User1 within Org1 using the discovery common connection profile
		And I update channel with name mychannel with config file mychannel-org1anchor.tx from the tls common connection profile

 	Scenario: Using a Gateway with discovery I can submit and evaluate transactions on instantiated node chaincode
		Given I install/instantiate node chaincode named marbles0 at version 1.0.0 as marbles to the tls Fabric network for all organizations on channel mychannel with endorsement policy 1AdminOr2Other and args [init,a,1000,b,2000]
	 	When I use the gateway named discovery_gateway to submit a transaction with args [initMarble,marble1,blue,50,bob] for chaincode marbles instantiated on channel mychannel
		Then The gateway named discovery_gateway has a submit type response
		When I use the gateway named discovery_gateway to evaluate transaction with args [readMarble,marble1] for chaincode marbles instantiated on channel mychannel
		Then The gateway named discovery_gateway has a evaluate type response matching {"color":"blue","docType":"marble","name":"marble1","owner":"bob","size":50}
