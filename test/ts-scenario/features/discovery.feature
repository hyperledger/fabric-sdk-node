#
# SPDX-License-Identifier: Apache-2.0
#

@discovery
@gateway
@fabric_merge
Feature: Configure Fabric using CLI and submit/evaluate using a network Gateway with discovery enabled

	Background:
		Given I place a scenario start message DISCOVERY FEATURE
		Given I deploy a tls Fabric network
		And I use the cli to create and join the channel named discoverychannel on the deployed network
		And I use the cli to update the channel with name discoverychannel with config file discoverychannel-anchor.tx on the deployed network
		And I use the cli to deploy a node smart contract named fabcar at version 1.0.0 for all organizations on channel discoverychannel with endorsement policy 1of and arguments ["initLedger"]
		And I have a file backed gateway named myDiscoveryGateway with discovery set to true for user User1 using the connection profile named ccp-tls.json

	Scenario: Using a Gateway I can submit and evaluate transactions on instantiated node smart contract
		When I use the gateway named myDiscoveryGateway to submit a transaction with args [createCar,1001,Ariel,Atom,red,Nick] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myDiscoveryGateway has a submit type response
		When I use the gateway named myDiscoveryGateway to evaluate a transaction with args [queryCar,1001] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myDiscoveryGateway has a evaluate type response matching {"color":"red","docType":"car","make":"Ariel","model":"Atom","owner":"Nick"}

	Scenario: Using a Gateway I recieve useful error messages when I submit or evaulate invalid transactions
		When I use the gateway named myDiscoveryGateway to submit a transaction with args [noSuchSubmitTransaction,1001,Trabant,601 Estate,brown,Simon] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myDiscoveryGateway has a error type response containing function that does not exist: noSuchSubmitTransaction
		When I use the gateway named myDiscoveryGateway to submit a transaction with args [createCar,9,Ford] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myDiscoveryGateway has a error type response containing No valid responses from any peers
		When I use the gateway named myDiscoveryGateway to evaluate a transaction with args [noSuchEvauateTransaction,1001] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myDiscoveryGateway has a error type response containing You've asked to invoke a function that does not exist: noSuchEvauateTransaction
		When I use the gateway named myDiscoveryGateway to evaluate a transaction with args [queryCar,because,I,said,so] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myDiscoveryGateway has a error type response containing Expected 1 parameters, but 4 have been supplied

	Scenario: Using a Gateway to submit transactions I can use different event handler strategies
		When I modify myDiscoveryGateway to submit a transaction with args [createCar,1002,Ford,Mustang,Silver,Andy] for contract fabcar instantiated on channel discoverychannel using handler option MSPID_SCOPE_ALLFORTX
		Then The gateway named myDiscoveryGateway has a event type response containing "status":"VALID"
		When I modify myDiscoveryGateway to submit a transaction with args [createCar,1003,Ford,Mustang,Silver,Andy] for contract fabcar instantiated on channel discoverychannel using handler option MSPID_SCOPE_ANYFORTX
		Then The gateway named myDiscoveryGateway has a event type response containing "status":"VALID"
		When I modify myDiscoveryGateway to submit a transaction with args [createCar,1004,Ford,Mustang,Silver,Andy] for contract fabcar instantiated on channel discoverychannel using handler option NETWORK_SCOPE_ALLFORTX
		Then The gateway named myDiscoveryGateway has a event type response containing "status":"VALID"
		When I modify myDiscoveryGateway to submit a transaction with args [createCar,1005,Ford,Mustang,Silver,Andy] for contract fabcar instantiated on channel discoverychannel using handler option NETWORK_SCOPE_ANYFORTX
		Then The gateway named myDiscoveryGateway has a event type response containing "status":"VALID"

	Scenario: Using a Gateway to evaluate transactions I can use different query handler strategies
		When I modify myDiscoveryGateway to evaluate a transaction with args [queryCar,1001] for contract fabcar instantiated on channel discoverychannel using handler option MSPID_SCOPE_SINGLE
		Then The gateway named myDiscoveryGateway has a evaluate type response matching {"color":"red","docType":"car","make":"Ariel","model":"Atom","owner":"Nick"}
		When I modify myDiscoveryGateway to evaluate a transaction with args [queryCar,1001] for contract fabcar instantiated on channel discoverychannel using handler option MSPID_SCOPE_ROUND_ROBIN
		Then The gateway named myDiscoveryGateway has a evaluate type response matching {"color":"red","docType":"car","make":"Ariel","model":"Atom","owner":"Nick"}
		When I modify myDiscoveryGateway to evaluate a transaction with args [queryCar,1001] for contract fabcar instantiated on channel discoverychannel using handler option custom
		Then The gateway named myDiscoveryGateway has a evaluate type response matching {"color":"red","docType":"car","make":"Ariel","model":"Atom","owner":"Nick"}

	Scenario: Using a Gateway I can use transient data
		When I modify myDiscoveryGateway to submit a transaction with transient data using args [getTransient,value1,value2] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myDiscoveryGateway has a submit type response matching {"key0":"value1","key1":"value2"}
		When I modify myDiscoveryGateway to evaluate a transaction with transient data using args [getTransient,valueA,valueB] for contract fabcar instantiated on channel discoverychannel
		Then The gateway named myDiscoveryGateway has a evaluate type response matching {"key0":"valueA","key1":"valueB"}