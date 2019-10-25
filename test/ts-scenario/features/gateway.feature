#
# SPDX-License-Identifier: Apache-2.0
#

@gateway_basic
@gateway
Feature: Configure Fabric using CLI and submit/evaluate using a network Gateway without discovery

	Background:
		Given I place a scenario start message GATEWAY FEATURE
	 	Given I deploy a tls Fabric network
	 	And I use the cli to create and join the channel named gatewaychannel on the deployed network
		And I use the cli to deploy a node smart contract named fabcar at version 1.0.0 for all organizations on channel gatewaychannel with endorsement policy 1ofAny and arguments ["initLedger"]

 	Scenario: Using a Gateway I can submit and evaluate transactions on instantiated node smart contract
		Given I have a couchDB backed gateway named mycouchgateway with discovery set to false for user User1 using the connection profile named ccp-tls.json
	    When I use the gateway named mycouchgateway to submit a transaction with args [createCar,1001,Trabant,601 Estate,brown,Simon] for contract fabcar instantiated on channel gatewaychannel
	    Then The gateway named mycouchgateway has a submit type response
	 	When I use the gateway named mycouchgateway to evaluate a transaction with args [queryCar,1001] for contract fabcar instantiated on channel gatewaychannel
	 	Then The gateway named mycouchgateway has a evaluate type response matching "{\"color\":\"brown\",\"docType\":\"car\",\"make\":\"Trabant\",\"model\":\"601 Estate\",\"owner\":\"Simon\"}"
