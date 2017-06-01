## v1.0.0-alpha.1 April, 28 2017

* [7eaa632](https://github.com/hyperledger/fabric/commit/7eaa632) [FAB-3492](https://jira.hyperledger.org/browse/FAB-3492) Do not allow grpc 1.3.0 or greater

## v1.0.0-alpha March 16, 2017

* [196d048](https://github.com/hyperledger/fabric/commit/196d048) Release v1.0.0-alpha
* [238f2d2](https://github.com/hyperledger/fabric/commit/238f2d2) Fix query.js test code to be more deterministic
* [c71ee2c](https://github.com/hyperledger/fabric/commit/c71ee2c) NodeSDK - return error object from proposals
* [6f77cdf](https://github.com/hyperledger/fabric/commit/6f77cdf) [FAB-1552](https://jira.hyperledger.org/browse/FAB-1552) Implement TLS support for fabric-ca-client
* [3afcb0a](https://github.com/hyperledger/fabric/commit/3afcb0a) Add tls support to node SDK
* [378f37c](https://github.com/hyperledger/fabric/commit/378f37c) Require mspid in User.setEnrollment()
* [add5598](https://github.com/hyperledger/fabric/commit/add5598) [FAB-2760](https://jira.hyperledger.org/browse/FAB-2760) Update fabric-ca-client
* [e2edc9b](https://github.com/hyperledger/fabric/commit/e2edc9b) NodeSDK - update for latest protos
* [dcd7a3a](https://github.com/hyperledger/fabric/commit/dcd7a3a) nodeSDK include all integration tests in gulp test
* [6e792c5](https://github.com/hyperledger/fabric/commit/6e792c5) Update genesis blocks for orderer and chain
* [a945fd1](https://github.com/hyperledger/fabric/commit/a945fd1) Further updates to README
* [f38340b](https://github.com/hyperledger/fabric/commit/f38340b) Minor fix in readme
* [ad5831f](https://github.com/hyperledger/fabric/commit/ad5831f) Add event listener to chain genesis block commit
* [a8ce9ca](https://github.com/hyperledger/fabric/commit/a8ce9ca) 'npm test' command broke
* [2a0fa90](https://github.com/hyperledger/fabric/commit/2a0fa90) NodeSDK - update to latest proto
* [05c6f83](https://github.com/hyperledger/fabric/commit/05c6f83) Update readme and ca build task
* [2384471](https://github.com/hyperledger/fabric/commit/2384471) Add query to new multi-org end2end test
* [45a3778](https://github.com/hyperledger/fabric/commit/45a3778) Enhance the default endorsement policy
* [665fc61](https://github.com/hyperledger/fabric/commit/665fc61) Create default policy of 'Signed By any member of org'
* [0303e44](https://github.com/hyperledger/fabric/commit/0303e44) nodeSDK Fix gulp test
* [da119b5](https://github.com/hyperledger/fabric/commit/da119b5) Revert accidental changes to original end-to-end
* [b95036b](https://github.com/hyperledger/fabric/commit/b95036b) Update e2e test to use multi-org setup
* [240605b](https://github.com/hyperledger/fabric/commit/240605b) NodeSDK - add getOrganizationalUnits() to Chain
* [3063a5b](https://github.com/hyperledger/fabric/commit/3063a5b) Create test sandbox materials for channels
* [49f4eb7](https://github.com/hyperledger/fabric/commit/49f4eb7) [FAB-2493](https://jira.hyperledger.org/browse/FAB-2493) Use a streaming tar to package chaincode
* [771a723](https://github.com/hyperledger/fabric/commit/771a723) make sendInstantiateProposal be chaincodeType neutral
* [3fc729a](https://github.com/hyperledger/fabric/commit/3fc729a) Remove special handling of base64 padding
* [999db30](https://github.com/hyperledger/fabric/commit/999db30) NodeSDK update event and query to latest protopuf
* [b32920d](https://github.com/hyperledger/fabric/commit/b32920d) Only enforce chaincodePath for GOLANG
* [d3fcbe2](https://github.com/hyperledger/fabric/commit/d3fcbe2) BCCSP config back to SHA2
* [2579307](https://github.com/hyperledger/fabric/commit/2579307) Allow fabric-ca-client to use per-instance crypto
* [bc36ef5](https://github.com/hyperledger/fabric/commit/bc36ef5) Modify chaincode packaging to comply
* [fa135f3](https://github.com/hyperledger/fabric/commit/fa135f3) [FAB-2383](https://jira.hyperledger.org/browse/FAB-2383) Add queries for Blockchain App
* [d61f388](https://github.com/hyperledger/fabric/commit/d61f388) Reorganize the chaincode package logic
* [9b9599f](https://github.com/hyperledger/fabric/commit/9b9599f) Hash algorithms for signing and txId
* [6c3547e](https://github.com/hyperledger/fabric/commit/6c3547e) Cleanup filenames which used "cop"
* [50b9370](https://github.com/hyperledger/fabric/commit/50b9370) Update test/fixtures/docker-compose.yml
* [abd80fb](https://github.com/hyperledger/fabric/commit/abd80fb) Add more tests to register/enroll/revoke
* [651aac8](https://github.com/hyperledger/fabric/commit/651aac8) Implement fabric-ca revoke() client
* [c1daab4](https://github.com/hyperledger/fabric/commit/c1daab4) nodeSDK sendInstallProposal chaincodePackage
* [3473608](https://github.com/hyperledger/fabric/commit/3473608) Add authentication to register()
* [f7f39c2](https://github.com/hyperledger/fabric/commit/f7f39c2) Support .car deployment
* [28ba8ce](https://github.com/hyperledger/fabric/commit/28ba8ce) Fix devmode install
* [70fe8ad](https://github.com/hyperledger/fabric/commit/70fe8ad) node-sdk [FAB-2456](https://jira.hyperledger.org/browse/FAB-2456) query.js exited without ending
* [b42979f](https://github.com/hyperledger/fabric/commit/b42979f) Don't include init-args in InstallProposal
* [8c74e04](https://github.com/hyperledger/fabric/commit/8c74e04) Update events test for renamed API
* [425028f](https://github.com/hyperledger/fabric/commit/425028f) Remove unused node.js modules
* [c1372a7](https://github.com/hyperledger/fabric/commit/c1372a7) NodeSDK - new channel - join channel
* [f0c89b3](https://github.com/hyperledger/fabric/commit/f0c89b3) [FAB-2017](https://jira.hyperledger.org/browse/FAB-2017) Parse metadata for invalid transactions
* [2ba668c](https://github.com/hyperledger/fabric/commit/2ba668c) Fix fabric-ca-client tests
* [1c3f361](https://github.com/hyperledger/fabric/commit/1c3f361) NodeSDK update for latest protos
* [c34c643](https://github.com/hyperledger/fabric/commit/c34c643) Restore couchdb-fabricca test
* [1e3c1b2](https://github.com/hyperledger/fabric/commit/1e3c1b2) nodeSDK Rename Deployment to Instantiate
* [0344555](https://github.com/hyperledger/fabric/commit/0344555) nodeSDK Fix test failures
* [084d3b5](https://github.com/hyperledger/fabric/commit/084d3b5) NodeSDK Update to latest Protos
* [2b5907c](https://github.com/hyperledger/fabric/commit/2b5907c) TxID compute with nonce + creator
* [a8554c1](https://github.com/hyperledger/fabric/commit/a8554c1) CouchDBKeyValueStore ctor to ask for url
* [f6a374c](https://github.com/hyperledger/fabric/commit/f6a374c) Move t.end() calls earlier to avoid confusion
* [b394db1](https://github.com/hyperledger/fabric/commit/b394db1) [FAB-2352](https://jira.hyperledger.org/browse/FAB-2352) Upgrade grpc package to 1.1.x
* [f34cfce](https://github.com/hyperledger/fabric/commit/f34cfce) NodeSDK update queryTransaction with new proto
* [a4641aa](https://github.com/hyperledger/fabric/commit/a4641aa) node-sdk Implement new cc install / deploy
* [59a96ce](https://github.com/hyperledger/fabric/commit/59a96ce) node-SDK [FAB-2258](https://jira.hyperledger.org/browse/FAB-2258) restore HTML coverage report
* [d621497](https://github.com/hyperledger/fabric/commit/d621497) should use "=" to assign value rather than "-"
* [7702584](https://github.com/hyperledger/fabric/commit/7702584) Use mixin to enforce CryptoKeyStore APIs
* [691af63](https://github.com/hyperledger/fabric/commit/691af63) Refactor headless-tests.js into individual files
* [bdcd351](https://github.com/hyperledger/fabric/commit/bdcd351) node-SDK [FAB-2184](https://jira.hyperledger.org/browse/FAB-2184) Fix coucbdb-fabricca-tests.js
* [4ed80ae](https://github.com/hyperledger/fabric/commit/4ed80ae) add inline jsdoc to msp-manager
* [da1c9ba](https://github.com/hyperledger/fabric/commit/da1c9ba) Add Cobertura reports in gulp task
* [1f22ed9](https://github.com/hyperledger/fabric/commit/1f22ed9) NodeSDK - add Queries
* [ba20656](https://github.com/hyperledger/fabric/commit/ba20656) Implement MSPManager and load MSPs from configs
* [e10d4ec](https://github.com/hyperledger/fabric/commit/e10d4ec) node-SDK Fix [FAB-2158](https://jira.hyperledger.org/browse/FAB-2158) pkcs11-tests.js fails
* [d03960d](https://github.com/hyperledger/fabric/commit/d03960d) [FAB-2002](https://jira.hyperledger.org/browse/FAB-2002) Add unit test for chaincode events
* [024f6f0](https://github.com/hyperledger/fabric/commit/024f6f0) Allow per-chain variations of BCCSP/CryptoSuite
* [d83c5ae](https://github.com/hyperledger/fabric/commit/d83c5ae) node-SDK Fix [FAB-2154](https://jira.hyperledger.org/browse/FAB-2154) - add unit tests
* [56c54ee](https://github.com/hyperledger/fabric/commit/56c54ee) [FAB-2065](https://jira.hyperledger.org/browse/FAB-2065) Update balance-transfer sample app
* [d32cdd2](https://github.com/hyperledger/fabric/commit/d32cdd2) Remove keysize parameter from ecdsa/key ctor
* [59e88c6](https://github.com/hyperledger/fabric/commit/59e88c6) NodeSDK - update to latest protos
* [5e43972](https://github.com/hyperledger/fabric/commit/5e43972) node-SDK Fix [FAB-2109](https://jira.hyperledger.org/browse/FAB-2109) doc.js
* [4cdabba](https://github.com/hyperledger/fabric/commit/4cdabba) Create a keystore class for improved code flow
* [b9d5f26](https://github.com/hyperledger/fabric/commit/b9d5f26) Delete files checked in by accident
* [e64871f](https://github.com/hyperledger/fabric/commit/e64871f) Add checking for getKey(ski) returning pub key
* [dfbf9be](https://github.com/hyperledger/fabric/commit/dfbf9be) [FAB-2060](https://jira.hyperledger.org/browse/FAB-2060) Transmit chaincodePath during deployment
* [f8f4acd](https://github.com/hyperledger/fabric/commit/f8f4acd) istanbul config needs to be updated
* [0fd7d2c](https://github.com/hyperledger/fabric/commit/0fd7d2c) Fix missing package winston
* [77ff639](https://github.com/hyperledger/fabric/commit/77ff639) Update .gitignore
* [0f4075f](https://github.com/hyperledger/fabric/commit/0f4075f) Move tx listener registration before sending tx
* [7a54782](https://github.com/hyperledger/fabric/commit/7a54782) Re-format end-to-end test with lambda
* [a8ff8cd](https://github.com/hyperledger/fabric/commit/a8ff8cd) [FAB-678](https://jira.hyperledger.org/browse/FAB-678) Omit dockerfile in deployment payload
* [a7318bb](https://github.com/hyperledger/fabric/commit/a7318bb) Remove 2 sec pause in E2E test
* [d871138](https://github.com/hyperledger/fabric/commit/d871138) Fix and rename cloudant and couchdb-fabriccop-tests
* [8ac3c44](https://github.com/hyperledger/fabric/commit/8ac3c44) [FAB-2016](https://jira.hyperledger.org/browse/FAB-2016) Fix step logic in end-to-end.js
* [3c3e665](https://github.com/hyperledger/fabric/commit/3c3e665) [FAB-929](https://jira.hyperledger.org/browse/FAB-929) Implement devmode deployment support
* [22ee9c8](https://github.com/hyperledger/fabric/commit/22ee9c8) Fix port numbers as per the commit in fabric
* [954ea4b](https://github.com/hyperledger/fabric/commit/954ea4b) Tighten the supported version ranges
* [450f6da](https://github.com/hyperledger/fabric/commit/450f6da) Fix e2e test to run with fabric-ca docker
* [6f74833](https://github.com/hyperledger/fabric/commit/6f74833) nodeSDK Fixes for [FAB-1702](https://jira.hyperledger.org/browse/FAB-1702) and FAB-1704
* [3dc987f](https://github.com/hyperledger/fabric/commit/3dc987f) Cleanup remaining references to COP
* [90d8d42](https://github.com/hyperledger/fabric/commit/90d8d42) [FAB-1948](https://jira.hyperledger.org/browse/FAB-1948): Allow users to provide GOPATH from CLI
* [afc53d4](https://github.com/hyperledger/fabric/commit/afc53d4) Fix typos
* [27f2438](https://github.com/hyperledger/fabric/commit/27f2438) Fix test/fixtures/docker-compose.yaml parse error
* [3add8f6](https://github.com/hyperledger/fabric/commit/3add8f6) Fix test/fixtures/docker-compose.yaml parse error
* [78f630f](https://github.com/hyperledger/fabric/commit/78f630f) Update npm package version
* [6d2858f](https://github.com/hyperledger/fabric/commit/6d2858f) Add missing bn.js to fabric-ca-client/package.json
* [fd3626b](https://github.com/hyperledger/fabric/commit/fd3626b) [FAB-1867](https://jira.hyperledger.org/browse/FAB-1867) end-to-end based example node program
* [a33d1c5](https://github.com/hyperledger/fabric/commit/a33d1c5) [FAB-1239](https://jira.hyperledger.org/browse/FAB-1239) register function for fabric-ca-client
* [1f9d5e4](https://github.com/hyperledger/fabric/commit/1f9d5e4) Update default test_chainid to testchainid
* [caf64fe](https://github.com/hyperledger/fabric/commit/caf64fe) Fix build break due to accidental inclusion
* [fd85330](https://github.com/hyperledger/fabric/commit/fd85330) Renaming the packages to official names
* [89b118c](https://github.com/hyperledger/fabric/commit/89b118c) Eventhub support for v1.0
* [24926ce](https://github.com/hyperledger/fabric/commit/24926ce) [FAB-1835](https://jira.hyperledger.org/browse/FAB-1835) Changes return values of chaincode
* [05e1fee](https://github.com/hyperledger/fabric/commit/05e1fee) Enhance importKey() to support private keys
* [babccee](https://github.com/hyperledger/fabric/commit/babccee) [FAB-1824](https://jira.hyperledger.org/browse/FAB-1824) CouchDBKeyValueStore setValue to return value
* [2c1b874](https://github.com/hyperledger/fabric/commit/2c1b874) BCCSP PKCS11 implementation for node.js SDK
* [d324cb6](https://github.com/hyperledger/fabric/commit/d324cb6) Rename fabric-cop reference in docker-compose file
* [ea8eea9](https://github.com/hyperledger/fabric/commit/ea8eea9) Fix regression due to [FAB-1787](https://jira.hyperledger.org/browse/FAB-1787)
* [867e3b5](https://github.com/hyperledger/fabric/commit/867e3b5) Use Emacs directory-variables
* [5e2d2dd](https://github.com/hyperledger/fabric/commit/5e2d2dd) SDK loads pre-provisioned users - step1
* [d9fc906](https://github.com/hyperledger/fabric/commit/d9fc906) NodeSDK - update test cases for new chain name
* [707e9ba](https://github.com/hyperledger/fabric/commit/707e9ba) [FAB-837](https://jira.hyperledger.org/browse/FAB-837) Add support and test for cloudant database
* [bcddb7f](https://github.com/hyperledger/fabric/commit/bcddb7f) NodeSDK - chain create, submit to peers-FAB-1734
* [0b53987](https://github.com/hyperledger/fabric/commit/0b53987) NodeSDK - update to latest protos
* [f61aad3](https://github.com/hyperledger/fabric/commit/f61aad3) [FAB-1756](https://jira.hyperledger.org/browse/FAB-1756) Add support for SHA384 hash
* [7eef633](https://github.com/hyperledger/fabric/commit/7eef633) Add headless tests to increase coverage
* [0d7c26c](https://github.com/hyperledger/fabric/commit/0d7c26c) Update docker-compose file to run end-to-end tests
* [6efdd72](https://github.com/hyperledger/fabric/commit/6efdd72) [FAB-1713](https://jira.hyperledger.org/browse/FAB-1713) add event stream port to test fixture
* [570e4bf](https://github.com/hyperledger/fabric/commit/570e4bf) Remove double-counted files in istanbul config
* [cb9f8c1](https://github.com/hyperledger/fabric/commit/cb9f8c1) [FAB-1263](https://jira.hyperledger.org/browse/FAB-1263) ECDSA signature malleability resistance
* [1dcc5fb](https://github.com/hyperledger/fabric/commit/1dcc5fb) Adding CouchDB KeyValueStore Implementation
* [0df2e6b](https://github.com/hyperledger/fabric/commit/0df2e6b) NodeSDK - updates for latest proto files
* [2f3d29e](https://github.com/hyperledger/fabric/commit/2f3d29e) NodeSDK chain create submit to orderer [FAB-1531](https://jira.hyperledger.org/browse/FAB-1531)
* [2c14385](https://github.com/hyperledger/fabric/commit/2c14385) Add eslint rules to enforce line length
* [7a2e5a4](https://github.com/hyperledger/fabric/commit/7a2e5a4) Fix incorrect license header
* [9cbb41e](https://github.com/hyperledger/fabric/commit/9cbb41e) Added missing CONTRIBUTING and MAINTAINERS files
* [34871dd](https://github.com/hyperledger/fabric/commit/34871dd) Added missing CONTRIBUTING and MAINTAINERS files
* [6808b0a](https://github.com/hyperledger/fabric/commit/6808b0a) Update enroll function for hfc-cop
* [6524a08](https://github.com/hyperledger/fabric/commit/6524a08) [FAB-1520](https://jira.hyperledger.org/browse/FAB-1520)Add duplicate check to SDK addPeer function
* [05dbba4](https://github.com/hyperledger/fabric/commit/05dbba4) [FAB-1522](https://jira.hyperledger.org/browse/FAB-1522) Start using the new SigningIdentity
* [00ede37](https://github.com/hyperledger/fabric/commit/00ede37) [FAB-1221](https://jira.hyperledger.org/browse/FAB-1221) Implement SigningIdentity
* [e6a2572](https://github.com/hyperledger/fabric/commit/e6a2572) Cleaning up old decrypt code
* [fbb3ae3](https://github.com/hyperledger/fabric/commit/fbb3ae3) [FAB-1517](https://jira.hyperledger.org/browse/FAB-1517) Add shake hash 256 to hash.js
* [3f67029](https://github.com/hyperledger/fabric/commit/3f67029) Fix error messages in orderer-chain-tests.js
* [5786857](https://github.com/hyperledger/fabric/commit/5786857) [FAB-1486](https://jira.hyperledger.org/browse/FAB-1486) Avoid duplicated transaction in e2e
* [662135e](https://github.com/hyperledger/fabric/commit/662135e) Fix docker-compose.yml for Test
* [129ca3c](https://github.com/hyperledger/fabric/commit/129ca3c) Fix unresolved variable and remove comma
* [17635eb](https://github.com/hyperledger/fabric/commit/17635eb) [FAB-1453](https://jira.hyperledger.org/browse/FAB-1453) Use Identity class in User.js
* [669acce](https://github.com/hyperledger/fabric/commit/669acce) [FAB-1421](https://jira.hyperledger.org/browse/FAB-1421) Implement Identity and MSP classes
* [9c3e33f](https://github.com/hyperledger/fabric/commit/9c3e33f) [FAB-1408](https://jira.hyperledger.org/browse/FAB-1408) enhance ecdsa/key.js for public key
* [3163575](https://github.com/hyperledger/fabric/commit/3163575) [FAB-1417](https://jira.hyperledger.org/browse/FAB-1417) Move peers from request.targets to Chain
* [04a9d05](https://github.com/hyperledger/fabric/commit/04a9d05) [FAB-985](https://jira.hyperledger.org/browse/FAB-985) Implement official SDK API design
* [fecedd7](https://github.com/hyperledger/fabric/commit/fecedd7) Delete duplicate check in _checkProposalRequest
* [b490e12](https://github.com/hyperledger/fabric/commit/b490e12) Add istanbul config file
* [bc2c406](https://github.com/hyperledger/fabric/commit/bc2c406) Updated README.md to be more accurate
* [12cd5de](https://github.com/hyperledger/fabric/commit/12cd5de) [FAB-1264](https://jira.hyperledger.org/browse/FAB-1264) allow e2e test to run each step
* [1949d11](https://github.com/hyperledger/fabric/commit/1949d11) NodeSDK - updates to protos
* [f3caf77](https://github.com/hyperledger/fabric/commit/f3caf77) [FAB-1272](https://jira.hyperledger.org/browse/FAB-1272) enhance marbles.js with steps
* [a1698aa](https://github.com/hyperledger/fabric/commit/a1698aa) NodeSDK updates for new protobufs
* [b26c06e](https://github.com/hyperledger/fabric/commit/b26c06e) Fix cert and csr test fixtures
* [edb5b12](https://github.com/hyperledger/fabric/commit/edb5b12) [FAB-1032](https://jira.hyperledger.org/browse/FAB-1032) fix "possible memory leak" warning
* [004ef32](https://github.com/hyperledger/fabric/commit/004ef32) [FAB-1245](https://jira.hyperledger.org/browse/FAB-1245) Move COP client tests to headless-tests
* [2a6987f](https://github.com/hyperledger/fabric/commit/2a6987f) [FAB-1235](https://jira.hyperledger.org/browse/FAB-1235) add setEnrollment() to Member
* [1f08e84](https://github.com/hyperledger/fabric/commit/1f08e84) [FAB-1084](https://jira.hyperledger.org/browse/FAB-1084) Move MemberServices out of HFC
* [68d7280](https://github.com/hyperledger/fabric/commit/68d7280) [FAB-1220](https://jira.hyperledger.org/browse/FAB-1220) update ecert persistence to PEM
* [d60dc6f](https://github.com/hyperledger/fabric/commit/d60dc6f) [FAB-1208](https://jira.hyperledger.org/browse/FAB-1208) update e2e test's creds for COP
* [c66a956](https://github.com/hyperledger/fabric/commit/c66a956) [FAB-1186](https://jira.hyperledger.org/browse/FAB-1186) add query at the end of marbles test
* [a7f57ba](https://github.com/hyperledger/fabric/commit/a7f57ba) [FAB-1182](https://jira.hyperledger.org/browse/FAB-1182) change SDK tests to use SHA256
* [3ebadb7](https://github.com/hyperledger/fabric/commit/3ebadb7) Fix minor bug in standlone COP test
* [223d769](https://github.com/hyperledger/fabric/commit/223d769) [FAB-1107](https://jira.hyperledger.org/browse/FAB-1107) Implement enroll function to work with COP
* [4672efe](https://github.com/hyperledger/fabric/commit/4672efe) Add CSR generation function to the ECDSA key class
* [ebfd858](https://github.com/hyperledger/fabric/commit/ebfd858) NodeSDK - Sign the Proposal and include cert
* [bb46f2c](https://github.com/hyperledger/fabric/commit/bb46f2c) [FAB-1148](https://jira.hyperledger.org/browse/FAB-1148) end-to-end test needs key size 256
* [1ed20f2](https://github.com/hyperledger/fabric/commit/1ed20f2) [FAB-1143](https://jira.hyperledger.org/browse/FAB-1143) endorser-tests.js bug in error responses
* [3df017d](https://github.com/hyperledger/fabric/commit/3df017d) [FAB-1108](https://jira.hyperledger.org/browse/FAB-1108) Initial impl of BCCSP
* [bcaaf24](https://github.com/hyperledger/fabric/commit/bcaaf24) [FAB-1051](https://jira.hyperledger.org/browse/FAB-1051) Node SDK to the latest protobuf defs
* [1c79e47](https://github.com/hyperledger/fabric/commit/1c79e47) [FAB-121](https://jira.hyperledger.org/browse/FAB-121) Support concurrent endorsement proposals
* [5222a00](https://github.com/hyperledger/fabric/commit/5222a00) NodeSDK deploy chain code with user name [FAB-1052](https://jira.hyperledger.org/browse/FAB-1052)
* [cabab55](https://github.com/hyperledger/fabric/commit/cabab55) NodeSDK prepare for multiple endorsing peers
* [013c1a2](https://github.com/hyperledger/fabric/commit/013c1a2) [FAB-1053](https://jira.hyperledger.org/browse/FAB-1053) remove generateNounce() from CryptoSuite API
* [74aaa9a](https://github.com/hyperledger/fabric/commit/74aaa9a) NodeSDK convert to new protos and add invoke and query
* [cf80346](https://github.com/hyperledger/fabric/commit/cf80346) [FAB-952](https://jira.hyperledger.org/browse/FAB-952) end-to-end test fails in a clean environment
* [4498b18](https://github.com/hyperledger/fabric/commit/4498b18) [FAB-950](https://jira.hyperledger.org/browse/FAB-950) self-contained chaincode deploy test setup
* [5bfcc6f](https://github.com/hyperledger/fabric/commit/5bfcc6f) Delete unused stats.js
* [eb8eeac](https://github.com/hyperledger/fabric/commit/eb8eeac) [FAB-938](https://jira.hyperledger.org/browse/FAB-938) Catch up e2e test to latest Peer protobuf
* [3ca4e6f](https://github.com/hyperledger/fabric/commit/3ca4e6f) [FAB-932](https://jira.hyperledger.org/browse/FAB-932) Gulp task to run tests with coverage reports
* [2e440f0](https://github.com/hyperledger/fabric/commit/2e440f0) [FAB-927](https://jira.hyperledger.org/browse/FAB-927) Updated README with docker-compose content
* [e0b4a69](https://github.com/hyperledger/fabric/commit/e0b4a69) [FAB-925](https://jira.hyperledger.org/browse/FAB-925) Use flat-chaining on Promise-based calls
* [20e8c7e](https://github.com/hyperledger/fabric/commit/20e8c7e) add npm test to gulp tasks
* [388af46](https://github.com/hyperledger/fabric/commit/388af46) [FAB-49](https://jira.hyperledger.org/browse/FAB-49) update endorser API to latest protobuf
* [171d374](https://github.com/hyperledger/fabric/commit/171d374) [FAB-926](https://jira.hyperledger.org/browse/FAB-926) Fixed headless-tests.js being stuck in Promise
* [83313c1](https://github.com/hyperledger/fabric/commit/83313c1) Fix end() called twice in headless-tests.js
* [32bb193](https://github.com/hyperledger/fabric/commit/32bb193) Add build and documentation badge in README
* [2b8b1a0](https://github.com/hyperledger/fabric/commit/2b8b1a0) minor README changes
* [74c09cf](https://github.com/hyperledger/fabric/commit/74c09cf) Add readthedocs doc files to fabric-sdk-node
* [21473c4](https://github.com/hyperledger/fabric/commit/21473c4) Added "happy path end-to-end test"
* [9731107](https://github.com/hyperledger/fabric/commit/9731107) NodeSDK add hierarchical configuration support [FAB-741](https://jira.hyperledger.org/browse/FAB-741)
* [7ba3992](https://github.com/hyperledger/fabric/commit/7ba3992) Fixed sendDeploymentProposal() promise chaining issue
* [0dbf4a7](https://github.com/hyperledger/fabric/commit/0dbf4a7) Enforce supported versions of node and npm
* [57bf3a1](https://github.com/hyperledger/fabric/commit/57bf3a1) Update fabric-sdk-node with changes from master
* [38c9517](https://github.com/hyperledger/fabric/commit/38c9517) Updated .gitignore to exclude "coverage" and "tmp"
* [cca09d6](https://github.com/hyperledger/fabric/commit/cca09d6) Updated README to include more contributor information
* [33f7b34](https://github.com/hyperledger/fabric/commit/33f7b34) Initial implementation for logging utility
* [9203fbb](https://github.com/hyperledger/fabric/commit/9203fbb) Add trailing spaces check to gulp lint
* [fb38844](https://github.com/hyperledger/fabric/commit/fb38844) Add CryptoSuite_ECDSA_SHA unit tests to headless-tests
* [dbcdb46](https://github.com/hyperledger/fabric/commit/dbcdb46) Adding Member Wrapper For Orderer
* [e5d06ea](https://github.com/hyperledger/fabric/commit/e5d06ea) Adding Orderer Class
* [25cbf0e](https://github.com/hyperledger/fabric/commit/25cbf0e) Initial implementation for sending endorser proposal
* [e127d5b](https://github.com/hyperledger/fabric/commit/e127d5b) Add tests to headless-tests.js
* [c5dd336](https://github.com/hyperledger/fabric/commit/c5dd336) Clean up the API
* [c0ea692](https://github.com/hyperledger/fabric/commit/c0ea692) Add gulp eslint task for common coding styles
* [869da76](https://github.com/hyperledger/fabric/commit/869da76) Changed to use ES6 class construct
* [0b2d441](https://github.com/hyperledger/fabric/commit/0b2d441) Refactored crypto-related APIs to be algorithm-agnostic
* [4d9b475](https://github.com/hyperledger/fabric/commit/4d9b475) Initial implementation


<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
s
