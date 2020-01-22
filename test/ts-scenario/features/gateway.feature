#
# SPDX-License-Identifier: Apache-2.0
#

@gateway_basic
@gateway
@fabric_merge
Feature: Configure Fabric using CLI and submit/evaluate using a network Gateway without discovery

	Background:
		Given I place a scenario start message GATEWAY FEATURE
	 	Given I deploy a tls Fabric network
	 	And I use the cli to create and join the channel named gatewaychannel on the deployed network
		And I use the cli to deploy a node smart contract named fabcar at version 1.0.0 for all organizations on channel gatewaychannel with endorsement policy 1ofAny and arguments ["initLedger"]
		And I have a couchDB backed gateway named mycouchgateway with discovery set to false for user User1 using the connection profile named ccp-tls.json

 	Scenario: Using a Gateway I can submit and evaluate transactions on instantiated node smart contract
		When I use the gateway named mycouchgateway to submit a transaction with args [createCar,1001,Trabant,601 Estate,brown,Simon] for contract fabcar instantiated on channel gatewaychannel
	    Then The gateway named mycouchgateway has a submit type response
	 	When I use the gateway named mycouchgateway to evaluate a transaction with args [queryCar,1001] for contract fabcar instantiated on channel gatewaychannel
	  	Then The gateway named mycouchgateway has a evaluate type response matching {"color":"brown","docType":"car","make":"Trabant","model":"601 Estate","owner":"Simon"}

	Scenario: Using a Gateway I recieve useful error messages when I submit or evaulate invalid transactions
		When I use the gateway named mycouchgateway to submit a transaction with args [noSuchSubmitTransaction,1001,Trabant,601 Estate,brown,Simon] for contract fabcar instantiated on channel gatewaychannel
		Then The gateway named mycouchgateway has a error type response containing Error: You've asked to invoke a function that does not exist: noSuchSubmitTransaction
		When I use the gateway named mycouchgateway to submit a transaction with args [createCar,9,Ford] for contract fabcar instantiated on channel gatewaychannel
		Then The gateway named mycouchgateway has a error type response containing Error: Expected 5 parameters, but 2 have been supplied
		When I use the gateway named mycouchgateway to evaluate a transaction with args [noSuchEvauateTransaction,1001] for contract fabcar instantiated on channel gatewaychannel
		Then The gateway named mycouchgateway has a error type response containing Error: You've asked to invoke a function that does not exist: noSuchEvauateTransaction
		When I use the gateway named mycouchgateway to evaluate a transaction with args [queryCar,because,I,said,so] for contract fabcar instantiated on channel gatewaychannel
		Then The gateway named mycouchgateway has a error type response containing Error: Expected 1 parameters, but 4 have been supplied

	Scenario: Using a Gateway to submit transactions I can use different event handler strategies
		When I modify mycouchgateway to submit a transaction with args [createCar,1002,Ford,Mustang,Silver,Andy] for contract fabcar instantiated on channel gatewaychannel using handler option MSPID_SCOPE_ALLFORTX
		Then The gateway named mycouchgateway has a event type response containing "status":"VALID"
		When I modify mycouchgateway to submit a transaction with args [createCar,1003,Ford,Mustang,Silver,Andy] for contract fabcar instantiated on channel gatewaychannel using handler option MSPID_SCOPE_ANYFORTX
		Then The gateway named mycouchgateway has a event type response containing "status":"VALID"
		When I modify mycouchgateway to submit a transaction with args [createCar,1004,Ford,Mustang,Silver,Andy] for contract fabcar instantiated on channel gatewaychannel using handler option NETWORK_SCOPE_ALLFORTX
		Then The gateway named mycouchgateway has a event type response containing "status":"VALID"
		When I modify mycouchgateway to submit a transaction with args [createCar,1005,Ford,Mustang,Silver,Andy] for contract fabcar instantiated on channel gatewaychannel using handler option NETWORK_SCOPE_ANYFORTX
		Then The gateway named mycouchgateway has a event type response containing "status":"VALID"

	Scenario: Using a Gateway I can use transient data
		When I modify mycouchgateway to submit a transaction with transient data using args [getTransient,value1,value2] for contract fabcar instantiated on channel gatewaychannel
		Then The gateway named mycouchgateway has a submit type response matching {"key0":"value1","key1":"value2"}
		When I modify mycouchgateway to evaluate a transaction with transient data using args [getTransient,valueA,valueB] for contract fabcar instantiated on channel gatewaychannel
		Then The gateway named mycouchgateway has a evaluate type response matching {"key0":"valueA","key1":"valueB"}

	Scenario: Using a Gateway to evaluate transactions I can use different query handler strategies
		When I modify mycouchgateway to evaluate a transaction with args [queryCar,1001] for contract fabcar instantiated on channel gatewaychannel using handler option MSPID_SCOPE_SINGLE
		Then The gateway named mycouchgateway has a evaluate type response matching {"color":"brown","docType":"car","make":"Trabant","model":"601 Estate","owner":"Simon"}
		When I modify mycouchgateway to evaluate a transaction with args [queryCar,1001] for contract fabcar instantiated on channel gatewaychannel using handler option MSPID_SCOPE_ROUND_ROBIN
		Then The gateway named mycouchgateway has a evaluate type response matching {"color":"brown","docType":"car","make":"Trabant","model":"601 Estate","owner":"Simon"}
		When I modify mycouchgateway to evaluate a transaction with args [queryCar,1001] for contract fabcar instantiated on channel gatewaychannel using handler option custom
		Then The gateway named mycouchgateway has a evaluate type response containing {"color":"brown","docType":"car","make":"Trabant","model":"601 Estate","owner":"Simon"}
