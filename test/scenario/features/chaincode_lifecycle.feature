#
# SPDX-License-Identifier: Apache-2.0
#

@debug

Feature: Use the v2.0 chaincode lifecycle process

	Background:
		Given I put a log message CHAINCODE LIFECYCLE TESTING
		Given I have forcibly taken down all docker containers

	Scenario: Using the SDK I can run new chaincode
		Given I have forcibly taken down all docker containers
		Given I have deployed a tls Fabric network
		Given I have created fabric-client network instances
		Then I can create and join a version_two capabilities channel named lifecyclechannel to two organizations

		And I can package node chaincode at version v1 named example_cc_node as organization org1 with goPath na located at ../../../../test/fixtures/chaincode/node_cc/example_cc and metadata located at ../../../../test/fixtures/chaincode/metadata with initrequired
		And I can package java chaincode at version v1 named example_cc_java as organization org1 with goPath na located at ../../../../test/fixtures/chaincode/java_cc/example_cc and metadata located at ../../../../test/fixtures/chaincode/metadata with initrequired
		And I can package golang chaincode at version v1 named example_cc_golang as organization org1 with goPath ../../../../test/fixtures/chaincode/goLang located at github.com/example_cc and metadata located at ../../../../test/fixtures/chaincode/metadata with initrequired

		And I can install node chaincode at version v1 named example_cc_node as organization org1
		And I can install java chaincode at version v1 named example_cc_java as organization org1
		And I can install golang chaincode at version v1 named example_cc_golang as organization org1

		And I can approve node chaincode at version v1 named example_cc_node as organization org1 on channel lifecyclechannel with endorsement policy both_orgs
		And I can approve java chaincode at version v1 named example_cc_java as organization org1 on channel lifecyclechannel with endorsement policy both_orgs
		And I can approve golang chaincode at version v1 named example_cc_golang as organization org1 on channel lifecyclechannel with endorsement policy both_orgs

		And I can package node chaincode at version v1 named example_cc_node as organization org2 with goPath na located at ../../../../test/fixtures/chaincode/node_cc/example_cc and metadata located at ../../../../test/fixtures/chaincode/metadata with initrequired
		And I can package java chaincode at version v1 named example_cc_java as organization org2 with goPath na located at ../../../../test/fixtures/chaincode/java_cc/example_cc and metadata located at ../../../../test/fixtures/chaincode/metadata with initrequired
		And I can package golang chaincode at version v1 named example_cc_golang as organization org2 with goPath ../../../../test/fixtures/chaincode/goLang located at github.com/example_cc and metadata located at ../../../../test/fixtures/chaincode/metadata with initrequired

		And I can install node chaincode at version v1 named example_cc_node as organization org2
		And I can install java chaincode at version v1 named example_cc_java as organization org2
		And I can install golang chaincode at version v1 named example_cc_golang as organization org2

		And I can approve node chaincode at version v1 named example_cc_node as organization org2 on channel lifecyclechannel with endorsement policy both_orgs
		And I can approve java chaincode at version v1 named example_cc_java as organization org2 on channel lifecyclechannel with endorsement policy both_orgs
		And I can approve golang chaincode at version v1 named example_cc_golang as organization org2 on channel lifecyclechannel with endorsement policy both_orgs

		And I can query for chaincode example_cc_node for commit status as organization org1 on channel lifecyclechannel
		And I can query for chaincode example_cc_java for commit status as organization org1 on channel lifecyclechannel
		And I can query for chaincode example_cc_golang for commit status as organization org1 on channel lifecyclechannel

		And I can commit node chaincode at version v1 named example_cc_node as organization org1 on channel lifecyclechannel
		And I can commit java chaincode at version v1 named example_cc_java as organization org1 on channel lifecyclechannel
		And I can commit golang chaincode at version v1 named example_cc_golang as organization org1 on channel lifecyclechannel

		And I can call init on chaincode named example_cc_node as organization org1 on channel lifecyclechannel with args ["a","1000","b","2000"]
		And I can call init on chaincode named example_cc_java as organization org1 on channel lifecyclechannel with args ["a","1000","b","2000"]
		And I can call init on chaincode named example_cc_golang as organization org1 on channel lifecyclechannel with args ["a","1000","b","2000"]

		And I can call move on chaincode named example_cc_node as organization org1 on channel lifecyclechannel with args ["a","b","100"]
		And I can call move on chaincode named example_cc_java as organization org1 on channel lifecyclechannel with args ["a","b","100"]
		And I can call move on chaincode named example_cc_golang as organization org1 on channel lifecyclechannel with args ["a","b","100"]

		And I can query for defined chaincode example_cc_node as organization org1 on channel lifecyclechannel
		And I can query for defined chaincode example_cc_java as organization org1 on channel lifecyclechannel
		And I can query for defined chaincode example_cc_golang as organization org1 on channel lifecyclechannel


		And I can query for chaincode example_cc_node for commit status as organization org1 on channel lifecyclechannel
		And I can query for chaincode example_cc_java for commit status as organization org1 on channel lifecyclechannel
		And I can query for chaincode example_cc_golang for commit status as organization org1 on channel lifecyclechannel

		And I can query installed chaincode example_cc_node as organization org1 on channel lifecyclechannel
		And I can query installed chaincode example_cc_java as organization org1 on channel lifecyclechannel
		And I can query installed chaincode example_cc_golang as organization org1 on channel lifecyclechannel

		And I can query installed chaincodes as organization org1 on channel lifecyclechannel
