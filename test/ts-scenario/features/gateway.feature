#
# SPDX-License-Identifier: Apache-2.0
#

@clean-gateway
@gateway
Feature: Configure Fabric using CLI and submit/evaluate using a network Gateway without discovery

	Background:
	 	Given I deploy a tls Fabric network
	 	And I use the cli to create and join the channel named mychannel on the deployed network
		And I use the cli to deploy a node smart contract named fabcar at version 1.0.0 for all organizations on channel mychannel with endorsement policy 1ofAny and arguments ["initLedger"]

 	Scenario: Using a Gateway I can submit and evaluate transactions on instantiated node smart contract
		Given I have a gateway named mygateway with discovery set to false for user User1 using the connection profile named ccp-tls.json
	    When I use the gateway named mygateway to submit a transaction with args [createCar,1001,Trabant,601 Estate,brown,Simon] for contract fabcar instantiated on channel mychannel
	    Then The gateway named mygateway has a submit type response
	 	When I use the gateway named mygateway to evaluate a transaction with args [queryCar,1001] for contract fabcar instantiated on channel mychannel
	 	Then The gateway named mygateway has a evaluate type response matching "{\"color\":\"brown\",\"docType\":\"car\",\"make\":\"Trabant\",\"model\":\"601 Estate\",\"owner\":\"Simon\"}"
