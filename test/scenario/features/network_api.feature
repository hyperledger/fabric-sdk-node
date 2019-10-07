#
# SPDX-License-Identifier: Apache-2.0
#

@networkAPI
@clean-gateway
Feature: Configure Fabric using SDK and submit/evaluate using a network Gateway

	Background:
		Given I put a log message NETWORK API TESTING
		Given I have forcibly taken down all docker containers
		Given I have deleted all dev images
		Given I have deployed a tls Fabric network
		And I have created and joined all channels from the tls common connection profile
		And I have created a gateway named test_gateway as user User1 within Org1 using the tls common connection profile

 	Scenario: Using a Gateway I can submit and evaluate transactions on instantiated node chaincode
		Given I force install/instantiate node chaincode named fabcar at version 1.0.0 as fabcar01 to the tls Fabric network for all organizations on channel mychannel with endorsement policy 1AdminOr2Other and args [initLedger]
		When I use the gateway named test_gateway to submit a transaction with args [createCar,1001,Trabant,601 Estate,brown,Simon] for chaincode fabcar01 instantiated on channel mychannel
		Then The gateway named test_gateway has a submit type response
		When I use the gateway named test_gateway to evaluate transaction with args [queryCar,1001] for chaincode fabcar01 instantiated on channel mychannel
		Then The gateway named test_gateway has a evaluate type response matching "{\"color\":\"brown\",\"docType\":\"car\",\"make\":\"Trabant\",\"model\":\"601 Estate\",\"owner\":\"Simon\"}"
