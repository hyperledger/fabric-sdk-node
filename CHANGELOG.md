## v2.2.0
Wed 15 Jul 2020 14:07:07 BST

* [87a393af](https://github.com/hyperledger/fabric-sdk-node/commit/87a393af) [FABN-1593](https://jira.hyperledger.org/browse/FABN-1593) update channel typescript defs (#272)
* [34a50138](https://github.com/hyperledger/fabric-sdk-node/commit/34a50138) Use Official CouchDB 3.1 Image (#265)
* [515ca942](https://github.com/hyperledger/fabric-sdk-node/commit/515ca942) Use proper event handler Gateway option in transaction-commit-events tutorial (#271)
* [e219e19c](https://github.com/hyperledger/fabric-sdk-node/commit/e219e19c) Change to snapshot versions post publish of v2.1.2 (#269)

## 2.1.2
Wed  1 Jul 2020 15:56:59 BST

* [55cee313](https://github.com/hyperledger/fabric-sdk-node/commit/55cee313) [[FABN-1685] jsrsasign Vulnerability: <GHSA-p8c3-7rj8-](https://jira.hyperledger.org/browse/FABN-1685] jsrsasign Vulnerability: <GHSA-p8c3-7rj8-)q963> (#263)
* [f13d529a](https://github.com/hyperledger/fabric-sdk-node/commit/f13d529a) [FABN-1571](https://jira.hyperledger.org/browse/FABN-1571) set discovery sort ledgerHeight (#260)
* [3f9c9d4a](https://github.com/hyperledger/fabric-sdk-node/commit/3f9c9d4a) [[FABN-1572](https://jira.hyperledger.org/browse/FABN-1572)] fabricCaClient.js hygiene (p1) (#242)
* [ed2121e5](https://github.com/hyperledger/fabric-sdk-node/commit/ed2121e5) [[FABN-835](https://jira.hyperledger.org/browse/FABN-835)] Fix recycle reference in Utils.js (#256)
* [e71b1260](https://github.com/hyperledger/fabric-sdk-node/commit/e71b1260) [FABN-1566](https://jira.hyperledger.org/browse/FABN-1566) Add TransactionError with event status (#258)
* [5b409b20](https://github.com/hyperledger/fabric-sdk-node/commit/5b409b20) [FABN-1584: Add protobufjs dependency for fabric-](https://jira.hyperledger.org/browse/FABN-1584: Add protobufjs dependency for fabric-)protos (#262)
* [e6673018](https://github.com/hyperledger/fabric-sdk-node/commit/e6673018) [FABN-1582](https://jira.hyperledger.org/browse/FABN-1582): Unit test for option pollution between gateway instances (#261)
* [0d566392](https://github.com/hyperledger/fabric-sdk-node/commit/0d566392) [[FABN-1544](https://jira.hyperledger.org/browse/FABN-1544)] Fix the property name of ProcessedTransaction (#257)
* [ff66fc66](https://github.com/hyperledger/fabric-sdk-node/commit/ff66fc66) [FABN-1582](https://jira.hyperledger.org/browse/FABN-1582): Fix leakage of Gateway confguration settings (#259)
* [d73d1a6b](https://github.com/hyperledger/fabric-sdk-node/commit/d73d1a6b) [FABN-1576](https://jira.hyperledger.org/browse/FABN-1576): Revert version and tag to snapshots (#255)

## v2.1.1
Wed Jun 17 09:52:17 EDT 2020

* [53898325](https://github.com/hyperledger/fabric-sdk-node/commit/53898325) [[FABN-1555](https://jira.hyperledger.org/browse/FABN-1555)] Update EventListener typedef and document (#239)
* [d22e1a1b](https://github.com/hyperledger/fabric-sdk-node/commit/d22e1a1b) [FABN-1544](https://jira.hyperledger.org/browse/FABN-1544) Update gRPC to pure js version (#247)
* [6f29724e](https://github.com/hyperledger/fabric-sdk-node/commit/6f29724e) [FABN-1570](https://jira.hyperledger.org/browse/FABN-1570): Better unstable version generation (#248)
* [430f4706](https://github.com/hyperledger/fabric-sdk-node/commit/430f4706) [FABN-1567](https://jira.hyperledger.org/browse/FABN-1567) Adding duplicates with discovery (#249)
* [7a70ad27](https://github.com/hyperledger/fabric-sdk-node/commit/7a70ad27) [FABN-1570](https://jira.hyperledger.org/browse/FABN-1570): Explicit dependency versions on publishing (#246)
* [4d662d75](https://github.com/hyperledger/fabric-sdk-node/commit/4d662d75) [FABN-1569](https://jira.hyperledger.org/browse/FABN-1569): Revert newDefaultKeyValueStore() to async (#241)
* [29cf613b](https://github.com/hyperledger/fabric-sdk-node/commit/29cf613b) [FABN-1573](https://jira.hyperledger.org/browse/FABN-1573): Use unique label per channel on chaincode package (#244)
* [1cb708df](https://github.com/hyperledger/fabric-sdk-node/commit/1cb708df) [FABN-1565](https://jira.hyperledger.org/browse/FABN-1565): Fix docs for DefaultEventHandlerStrategies (#240)
* [c7f33a9b](https://github.com/hyperledger/fabric-sdk-node/commit/c7f33a9b) [[FABN-835](https://jira.hyperledger.org/browse/FABN-835)] Refactor CryptoKeyStore (Part 3) (#208)
* [ba119799](https://github.com/hyperledger/fabric-sdk-node/commit/ba119799) [FABN-1557](https://jira.hyperledger.org/browse/FABN-1557) NodeSDK all restart event service (#237)
* [44bbab02](https://github.com/hyperledger/fabric-sdk-node/commit/44bbab02) [FABN-1536](https://jira.hyperledger.org/browse/FABN-1536): Return copy from IdentityContext.calculateTransactionId() (#236)
* [b6a20bcd](https://github.com/hyperledger/fabric-sdk-node/commit/b6a20bcd) [FABN-1536](https://jira.hyperledger.org/browse/FABN-1536): Make transaction ID available before submit (#235)
* [07b93c26](https://github.com/hyperledger/fabric-sdk-node/commit/07b93c26) Fix when endBlock is of string type (#233)
* [b8cc3a8f](https://github.com/hyperledger/fabric-sdk-node/commit/b8cc3a8f) [FABN-1549](https://jira.hyperledger.org/browse/FABN-1549): JSDoc fixes (#234)
* [2da3e188](https://github.com/hyperledger/fabric-sdk-node/commit/2da3e188) [FABN-1549: Remove non-TypeScript build for fabric-](https://jira.hyperledger.org/browse/FABN-1549: Remove non-TypeScript build for fabric-)network (#231)
* [5c0a28b2](https://github.com/hyperledger/fabric-sdk-node/commit/5c0a28b2) [FABN-1549: Convert remaining fabric-](https://jira.hyperledger.org/browse/FABN-1549: Convert remaining fabric-)network source to TypeScript (#230)
* [251038a3](https://github.com/hyperledger/fabric-sdk-node/commit/251038a3) Fix some audit complaints (#229)
* [9497ed20](https://github.com/hyperledger/fabric-sdk-node/commit/9497ed20) Add missing copyright to several files (#227)
* [db6711b4](https://github.com/hyperledger/fabric-sdk-node/commit/db6711b4) [FABN-1539](https://jira.hyperledger.org/browse/FABN-1539) NodeSDK limit "all" transaction event listening (#212)
* [48d1c4ba](https://github.com/hyperledger/fabric-sdk-node/commit/48d1c4ba) Update SoftHSM Label (#228)
* [f79cd20e](https://github.com/hyperledger/fabric-sdk-node/commit/f79cd20e) Update link to HLP security report wiki page (#226)
* [5e6d19c1](https://github.com/hyperledger/fabric-sdk-node/commit/5e6d19c1) [FABN-1550](https://jira.hyperledger.org/browse/FABN-1550): Await call to async function in NetworkConfig (#225)
* [df2eb45c](https://github.com/hyperledger/fabric-sdk-node/commit/df2eb45c) [FAB-17777](https://jira.hyperledger.org/browse/FAB-17777) Create basic settings.yaml (#220)
* [c8bb029b](https://github.com/hyperledger/fabric-sdk-node/commit/c8bb029b) [FABN-1548](https://jira.hyperledger.org/browse/FABN-1548) NodeSDK move HSM to scenario test (#224)
* [cb1f572b](https://github.com/hyperledger/fabric-sdk-node/commit/cb1f572b) [FABN-1546](https://jira.hyperledger.org/browse/FABN-1546): Connect Gateway without a wallet (#222)
* [bf5fa51f](https://github.com/hyperledger/fabric-sdk-node/commit/bf5fa51f) Add Fabric Version to CI Props (#221)
* [fe2d00bb](https://github.com/hyperledger/fabric-sdk-node/commit/fe2d00bb) [FABN-1543 TypeScript declaration file in fabric-](https://jira.hyperledger.org/browse/FABN-1543 TypeScript declaration file in fabric-)common module does not match with the actual implementation (#217)
* [377a9af5](https://github.com/hyperledger/fabric-sdk-node/commit/377a9af5) [FABN-1540](https://jira.hyperledger.org/browse/FABN-1540) NodeSDK remove ccp roles (#215)

## v2.1.0
Wed 8 Apr 2020 17:06:37 BST

* [4406642f](https://github.com/hyperledger/fabric-sdk-node/commit/4406642f) [FABN-1531](https://jira.hyperledger.org/browse/FABN-1531) Update references to 2.0 and 2.0.0 (#210)
* [bc50a107](https://github.com/hyperledger/fabric-sdk-node/commit/bc50a107) [FABN-1536](https://jira.hyperledger.org/browse/FABN-1536) NodeSDK add getTransactionId (#209)
* [03deb129](https://github.com/hyperledger/fabric-sdk-node/commit/03deb129) Import ByteBuffer type to prevent TypeScript error (#206)
* [e4c8e78c](https://github.com/hyperledger/fabric-sdk-node/commit/e4c8e78c) Use 2.1 Fabric Images (#205)
* [1abaa4c3](https://github.com/hyperledger/fabric-sdk-node/commit/1abaa4c3) Pull Fabric Images in CI (#204)
* [361a7adf](https://github.com/hyperledger/fabric-sdk-node/commit/361a7adf) [FABN-1224](https://jira.hyperledger.org/browse/FABN-1224) NodeSDK discovery interests (#203)
* [0e8dfa88](https://github.com/hyperledger/fabric-sdk-node/commit/0e8dfa88) [FABN-1524](https://jira.hyperledger.org/browse/FABN-1524): Default file checkpointer implementation (#201)
* [f6e8ae36](https://github.com/hyperledger/fabric-sdk-node/commit/f6e8ae36) [FABN-1524](https://jira.hyperledger.org/browse/FABN-1524): JSDoc for checkpointer (#200)
* [a2999388](https://github.com/hyperledger/fabric-sdk-node/commit/a2999388) [FABN-1524](https://jira.hyperledger.org/browse/FABN-1524): Checkpoint contract events (#199)
* [9ba41f8e](https://github.com/hyperledger/fabric-sdk-node/commit/9ba41f8e) [FABN-1532](https://jira.hyperledger.org/browse/FABN-1532 NodeSDK allow for non-)TLS networks (#198)
* [e415c40c](https://github.com/hyperledger/fabric-sdk-node/commit/e415c40c) [FABN-1523](https://jira.hyperledger.org/browse/FABN-1523): Checkpoint block listening (#197)
* [d3aee6fc](https://github.com/hyperledger/fabric-sdk-node/commit/d3aee6fc) [FABN-1526](https://jira.hyperledger.org/browse/FABN-1526): Minor doc tweaks based on review feedback (#196)
* [8c9f8e1d](https://github.com/hyperledger/fabric-sdk-node/commit/8c9f8e1d) [FABN-1526](https://jira.hyperledger.org/browse/FABN-1526): Home page to allow access to v1.4 and v2.0 docs (#195)
* [ac8c7878](https://github.com/hyperledger/fabric-sdk-node/commit/ac8c7878) [FABN-1526](https://jira.hyperledger.org/browse/FABN-1526) Remove old tutorial (#194)
* [abe6e78a](https://github.com/hyperledger/fabric-sdk-node/commit/abe6e78a) [FABN-1519](https://jira.hyperledger.org/browse/FABN-1519): More robust private data scenario test (#193)
* [192678e3](https://github.com/hyperledger/fabric-sdk-node/commit/192678e3) [FABN-1525](https://jira.hyperledger.org/browse/FABN-1525): Application migration tutorial (#191)
* [4697ea75](https://github.com/hyperledger/fabric-sdk-node/commit/4697ea75) [FABN-1461](https://jira.hyperledger.org/browse/FABN-1461) NodeSDK private data part 2 (#192)
* [9560c414](https://github.com/hyperledger/fabric-sdk-node/commit/9560c414) [FABN-1519](https://jira.hyperledger.org/browse/FABN-1519): Refactor of full and private event factory (#190)
* [1f446c66](https://github.com/hyperledger/fabric-sdk-node/commit/1f446c66) [FABN-1522](https://jira.hyperledger.org/browse/FABN-1522): load the value of config.orderers (#189)
* [ecdbeb94](https://github.com/hyperledger/fabric-sdk-node/commit/ecdbeb94) [FABN-1461](https://jira.hyperledger.org/browse/FABN-1461) NodeSDK add private data event (#102)
* [c951f2d5](https://github.com/hyperledger/fabric-sdk-node/commit/c951f2d5) [FABN-1519](https://jira.hyperledger.org/browse/FABN-1519): Event listening with private data (#188)
* [8b1a763b](https://github.com/hyperledger/fabric-sdk-node/commit/8b1a763b) [FABN-1518](https://jira.hyperledger.org/browse/FABN-1518): Correction to example block listener code in JSDoc (#187)
* [2f3c524a](https://github.com/hyperledger/fabric-sdk-node/commit/2f3c524a) [FABN-1518](https://jira.hyperledger.org/browse/FABN-1518): Update JSDoc for event listening (#185)
* [07e6d828](https://github.com/hyperledger/fabric-sdk-node/commit/07e6d828) [FABN-1521](https://jira.hyperledger.org/browse/FABN-1521) NodeSDK Add setEndpoint to typscript (#183)
* [f8aecd73](https://github.com/hyperledger/fabric-sdk-node/commit/f8aecd73) [FABN-1516](https://jira.hyperledger.org/browse/FABN-1516 revert to 2.0.0-)snapshots (#182)
* [ad42bd14](https://github.com/hyperledger/fabric-sdk-node/commit/ad42bd14) [FABN-1516](https://jira.hyperledger.org/browse/FABN-1516 Release 2.0.0-)beta.4 (#180)
* [1d276005](https://github.com/hyperledger/fabric-sdk-node/commit/1d276005) [FABN-1510](https://jira.hyperledger.org/browse/FABN-1510) Port grpc update (#181)

## v2.0.0-beta.4
Mon 16 Mar 2020 15:27:54 GMT

* [daf40d7f](https://github.com/hyperledger/fabric-sdk-node/commit/daf40d7f) [FABN-1518](https://jira.hyperledger.org/browse/FABN-1518): Full block event listening (#176)
* [18f110f2](https://github.com/hyperledger/fabric-sdk-node/commit/18f110f2) [FABN-1513](https://jira.hyperledger.org/browse/FABN-1513): Add a new "extensions" param to generateCSR (#167)
* [2ea18d36](https://github.com/hyperledger/fabric-sdk-node/commit/2ea18d36) Match fabric-network API to v1.4 as closely as possible (#171)
* [0eb8838f](https://github.com/hyperledger/fabric-sdk-node/commit/0eb8838f) [FABN-1506](https://jira.hyperledger.org/browse/FABN-1506): JSDoc improvements (#170)
* [0c0c6869](https://github.com/hyperledger/fabric-sdk-node/commit/0c0c6869) Re-enable coverage reporting for unit tests (#169)
* [32665337](https://github.com/hyperledger/fabric-sdk-node/commit/32665337) [FABN-1495](https://jira.hyperledger.org/browse/FABN-1495) Remove unused event code (#168)
* [4ecca00a](https://github.com/hyperledger/fabric-sdk-node/commit/4ecca00a) [FABN-1506](https://jira.hyperledger.org/browse/FABN-1506): JSDoc for block, contract and commit events (#166)
* [ac93f729](https://github.com/hyperledger/fabric-sdk-node/commit/ac93f729) [FABN-1492](https://jira.hyperledger.org/browse/FABN-1492): Add isValid() convenience method to transaction events (#165)
* [c3320963](https://github.com/hyperledger/fabric-sdk-node/commit/c3320963) [FABN-1494](https://jira.hyperledger.org/browse/FABN-1494) Replay contract events (#161)
* [aad140bf](https://github.com/hyperledger/fabric-sdk-node/commit/aad140bf) [FABN-1492](https://jira.hyperledger.org/browse/FABN-1492): Refactor block, contract and commit events (#162)
* [fea01f0d](https://github.com/hyperledger/fabric-sdk-node/commit/fea01f0d) [FABN-1492](https://jira.hyperledger.org/browse/FABN-1492): Define a specific BlockEvent type (#160)
* [94c9a2ef](https://github.com/hyperledger/fabric-sdk-node/commit/94c9a2ef) [FABN-835](https://jira.hyperledger.org/browse/FABN-835): Refactor CryptoKeyStore (#150)
* [53b77783](https://github.com/hyperledger/fabric-sdk-node/commit/53b77783) [FABN-1505](https://jira.hyperledger.org/browse/FABN-1505) Port changes for winston dep into master (#159)
* [d953eaa0](https://github.com/hyperledger/fabric-sdk-node/commit/d953eaa0) [FABN-1492](https://jira.hyperledger.org/browse/FABN-1492) Realtime contract event listening (#152)
* [04beb82a](https://github.com/hyperledger/fabric-sdk-node/commit/04beb82a) [FABN-1439](https://jira.hyperledger.org/browse/FABN-1439): Add Node 10 as tested platform in compatibility matrix (#156)
* [fb39badb](https://github.com/hyperledger/fabric-sdk-node/commit/fb39badb) [FABN-1507](https://jira.hyperledger.org/browse/FABN-1507) Use published fabric 2.0 docker images and increase cucumber timeouts on commit and endorse (#154)
* [0507138d](https://github.com/hyperledger/fabric-sdk-node/commit/0507138d) [FABN-1493](https://jira.hyperledger.org/browse/FABN-1493): Ensure non-shared event services are closed (#149)
* [ff3f86d6](https://github.com/hyperledger/fabric-sdk-node/commit/ff3f86d6) [FABN-1493](https://jira.hyperledger.org/browse/FABN-1493): Block event replay (#147)
* [ddf1d715](https://github.com/hyperledger/fabric-sdk-node/commit/ddf1d715) [FABN-1491](https://jira.hyperledger.org/browse/FABN-1491): Updated realtime block event listening (#144)
* [c31fa5ea](https://github.com/hyperledger/fabric-sdk-node/commit/c31fa5ea) [FABN-835](https://jira.hyperledger.org/browse/FABN-835): Refactor CryptoKeyStore (#145)
* [373a6a8d](https://github.com/hyperledger/fabric-sdk-node/commit/373a6a8d) [FABN-1498](https://jira.hyperledger.org/browse/FABN-1498) NodeSDK ccp handle missing orderers (#137)
* [8156c0d5](https://github.com/hyperledger/fabric-sdk-node/commit/8156c0d5) [FABN-1499](https://jira.hyperledger.org/browse/FABN-1499) NodeSDK update protos v2.0.0 (#139)
* [d37dc852](https://github.com/hyperledger/fabric-sdk-node/commit/d37dc852) [FABN-1396](https://jira.hyperledger.org/browse/FABN-1396) Even more test/scenario cleanup (#135)
* [c201b5fd](https://github.com/hyperledger/fabric-sdk-node/commit/c201b5fd) [FABN-1489](https://jira.hyperledger.org/browse/FABN-1489) Clean up cucumber scenario tests for commit event handlers (#128)
* [8f3ca2e1](https://github.com/hyperledger/fabric-sdk-node/commit/8f3ca2e1) [FABN-1486](https://jira.hyperledger.org/browse/FABN-1486): Update sample transaction event handler (#136)
* [ef36a919](https://github.com/hyperledger/fabric-sdk-node/commit/ef36a919) [FABN-1489](https://jira.hyperledger.org/browse/FABN-1489) Clean up integration tests (#134)
* [8d07f263](https://github.com/hyperledger/fabric-sdk-node/commit/8d07f263) [FABN-1485](https://jira.hyperledger.org/browse/FABN-1485): Use commit event listener in TransactionEventHandler (#129)
* [49ef338c](https://github.com/hyperledger/fabric-sdk-node/commit/49ef338c) [FABN-1478](https://jira.hyperledger.org/browse/FABN-1478): Rework Network.addCommitListener() (#126)
* [45cf6f59](https://github.com/hyperledger/fabric-sdk-node/commit/45cf6f59) [FABN-1496](https://jira.hyperledger.org/browse/FABN-1496): NodeSDK use fabric-shim 2.0.0 (#133)
* [c66e1ed6](https://github.com/hyperledger/fabric-sdk-node/commit/c66e1ed6) [FABN-1497](https://jira.hyperledger.org/browse/FABN-1497) NodeSDK return master to snapshots (#131)
* [440564e2](https://github.com/hyperledger/fabric-sdk-node/commit/440564e2) [FABN-1396](https://jira.hyperledger.org/browse/FABN-1396) Remove unused chaincode contracts from test/scenario (#130)

## v2.0.0-beta.3
Thu Feb 13 17:31:21 EST 2020

* [d8d99d08](https://github.com/hyperledger/fabric-sdk-node/commit/d8d99d08) [FABN-1477](https://jira.hyperledger.org/browse/FABN-1477) NodeSDK publish beta.3
* [5d61cfde](https://github.com/hyperledger/fabric-sdk-node/commit/5d61cfde) [FABN-1464](https://jira.hyperledger.org/browse/FABN-1464) NodeSDK update queryHandling (#105)
* [854dba2a](https://github.com/hyperledger/fabric-sdk-node/commit/854dba2a) Fix module publishing (#125)
* [bf6675a4](https://github.com/hyperledger/fabric-sdk-node/commit/bf6675a4) [[FABN-1481](https://jira.hyperledger.org/browse/FABN-1481)] Fix api docs publishing (#124)
* [135a2484](https://github.com/hyperledger/fabric-sdk-node/commit/135a2484) [[FABN-1481](https://jira.hyperledger.org/browse/FABN-1481)] Remove node 8 support and add node 12 (#123)
* [25de487f](https://github.com/hyperledger/fabric-sdk-node/commit/25de487f) [FABN-1484](https://jira.hyperledger.org/browse/FABN-1484) NodeSDK ledger height discovery sort (#122)
* [c5d8148d](https://github.com/hyperledger/fabric-sdk-node/commit/c5d8148d) [FABN-1483](https://jira.hyperledger.org/browse/FABN-1483) NodeSDK set self signed cert (#121)
* [b76cdd4d](https://github.com/hyperledger/fabric-sdk-node/commit/b76cdd4d) [FABN-1482](https://jira.hyperledger.org/browse/FABN-1482) NodeSDK missing dependencies (#120)
* [acfb9098](https://github.com/hyperledger/fabric-sdk-node/commit/acfb9098) [FABN-1480](https://jira.hyperledger.org/browse/FABN-1480) NodeSDK initialize the config system (#119)
* [fb72b2c8](https://github.com/hyperledger/fabric-sdk-node/commit/fb72b2c8) [FABN-1476: Temporarily remove fabric-](https://jira.hyperledger.org/browse/FABN-1476: Temporarily remove fabric-)network listener APIs (#116)
* [f63c19fd](https://github.com/hyperledger/fabric-sdk-node/commit/f63c19fd) [FABN-1479](https://jira.hyperledger.org/browse/FABN-1479) NodeSDK fix HSM tests (#115)
* [742b7458](https://github.com/hyperledger/fabric-sdk-node/commit/742b7458) [[FABN-1430](https://jira.hyperledger.org/browse/FABN-1430)] Fix type for IServiceResponse (#62)
* [240db1dc](https://github.com/hyperledger/fabric-sdk-node/commit/240db1dc) [FABN-1455: Re-](https://jira.hyperledger.org/browse/FABN-1455: Re-)add removed unit tests in transaction.js (#109)
* [d5495f99](https://github.com/hyperledger/fabric-sdk-node/commit/d5495f99) add responses to exception thrown from submitTransaction (#111)
* [9276072b](https://github.com/hyperledger/fabric-sdk-node/commit/9276072b) [FABN-1465 NodeSDK remove fabric-](https://jira.hyperledger.org/browse/FABN-1465 NodeSDK remove fabric-)client (#110)
* [e00798d8](https://github.com/hyperledger/fabric-sdk-node/commit/e00798d8) [FABN-1458](https://jira.hyperledger.org/browse/FABN-1458) NodeSDK commit all endorsed (#97)
* [fc28cbb5](https://github.com/hyperledger/fabric-sdk-node/commit/fc28cbb5) [FABN-1452 NodeSDK add fabric-](https://jira.hyperledger.org/browse/FABN-1452 NodeSDK add fabric-)common doc (#96)
* [ca255008](https://github.com/hyperledger/fabric-sdk-node/commit/ca255008) [FABN-1455: Re-](https://jira.hyperledger.org/browse/FABN-1455: Re-)enable unit tests for transactioneventhandler.js (#99)
* [f5ab6a8c](https://github.com/hyperledger/fabric-sdk-node/commit/f5ab6a8c) [[FABN-1459](https://jira.hyperledger.org/browse/FABN-1459)] Remove extra tsconfig files (#98)
* [fdaa8b44](https://github.com/hyperledger/fabric-sdk-node/commit/fdaa8b44) [[FABN-1039](https://jira.hyperledger.org/browse/FABN-1039)] Clean up node dependencies (#95)
* [94bcabc5](https://github.com/hyperledger/fabric-sdk-node/commit/94bcabc5) [FABN-1453](https://jira.hyperledger.org/browse/FABN-1453) NodeSDK add discovery test (#94)
* [af143157](https://github.com/hyperledger/fabric-sdk-node/commit/af143157) [FABN-1446](https://jira.hyperledger.org/browse/FABN-1446): Specific compatibility matrix for v2.0 (#93)
* [aadf3be1](https://github.com/hyperledger/fabric-sdk-node/commit/aadf3be1) [FABN-1347 NodeSDK refactor fabric-](https://jira.hyperledger.org/browse/FABN-1347 NodeSDK refactor fabric-)network (#68)
* [9851e8e6](https://github.com/hyperledger/fabric-sdk-node/commit/9851e8e6) [FABN-1446](https://jira.hyperledger.org/browse/FABN-1446): Add compatibility matrix to docs (#91)
* [d084b6d9](https://github.com/hyperledger/fabric-sdk-node/commit/d084b6d9) [[FABCI-482](https://jira.hyperledger.org/browse/FABCI-482)] Change Nexus URLs to Artifactory (#81)
* [b6c64de7](https://github.com/hyperledger/fabric-sdk-node/commit/b6c64de7) [FABN-1440](https://jira.hyperledger.org/browse/FABN-1440): Fix docstrap theme on master api docs (#88)
* [50cebaa8](https://github.com/hyperledger/fabric-sdk-node/commit/50cebaa8) [FABN-1444](https://jira.hyperledger.org/browse/FABN-1444): Better errors for missing identities (#87)
* [eab743c1](https://github.com/hyperledger/fabric-sdk-node/commit/eab743c1) Update chat handle
* [8dd365ed](https://github.com/hyperledger/fabric-sdk-node/commit/8dd365ed) Add build status badge (#85)
* [b1fbefd6](https://github.com/hyperledger/fabric-sdk-node/commit/b1fbefd6) Update CODEOWNERS (#84)
* [ba231be7](https://github.com/hyperledger/fabric-sdk-node/commit/ba231be7) Add Heather Pollard as maintainer (#83)
* [9f18701c](https://github.com/hyperledger/fabric-sdk-node/commit/9f18701c) (Master) Add Mark Lewis as a maintainer (#78)
* [726c61f1](https://github.com/hyperledger/fabric-sdk-node/commit/726c61f1) [FABN-1428](https://jira.hyperledger.org/browse/FABN-1428): Point to new API documentation site (#80)
* [c5eaf353](https://github.com/hyperledger/fabric-sdk-node/commit/c5eaf353) [FABN-1439](https://jira.hyperledger.org/browse/FABN-1439): Use Node 12 (#79)
* [a9577414](https://github.com/hyperledger/fabric-sdk-node/commit/a9577414) Revert "[[FABN-1435] Publish 2.0.0-](https://jira.hyperledger.org/browse/FABN-1435] Publish 2.0.0-)beta.2" (#76)
* [c1c0bcad](https://github.com/hyperledger/fabric-sdk-node/commit/c1c0bcad) Improve readability by using interpolation (#75)
* [2cb20d48](https://github.com/hyperledger/fabric-sdk-node/commit/2cb20d48) [FABN-1039](https://jira.hyperledger.org/browse/FABN-1039): Fix master branch doc publishing (#74)
* [5124fd78](https://github.com/hyperledger/fabric-sdk-node/commit/5124fd78) [[FABN-1435] Publish 2.0.0-](https://jira.hyperledger.org/browse/FABN-1435] Publish 2.0.0-)beta.2
* [55b5398d](https://github.com/hyperledger/fabric-sdk-node/commit/55b5398d) [[FABN-1435] Remove stream-](https://jira.hyperledger.org/browse/FABN-1435] Remove stream-)buffers from lifecycle code (#71)
* [d06fcdf2](https://github.com/hyperledger/fabric-sdk-node/commit/d06fcdf2) [FABN-1433](https://jira.hyperledger.org/browse/FABN-1433) NodeSDK return to snapshot (#70)
* [558cea43](https://github.com/hyperledger/fabric-sdk-node/commit/558cea43) Wallet interop test (#69)
* [6eb90b88](https://github.com/hyperledger/fabric-sdk-node/commit/6eb90b88) [[FABN-1308](https://jira.hyperledger.org/browse/FABN-1308)] Enable checkpointing when start or end block are given (#51)
* [6e398bcf](https://github.com/hyperledger/fabric-sdk-node/commit/6e398bcf) [FABN-1039](https://jira.hyperledger.org/browse/FABN-1039)] Replace gulp with npm scripts
* [7bb78d33](https://github.com/hyperledger/fabric-sdk-node/commit/7bb78d33) [FABN-1432](https://jira.hyperledger.org/browse/FABN-1432) NodeSDK publish v2 beta.1
* [7b9f2527](https://github.com/hyperledger/fabric-sdk-node/commit/7b9f2527) Align Java and Node wallet API naming (#65)
* [11b5a553](https://github.com/hyperledger/fabric-sdk-node/commit/11b5a553) Add NPM credential group (#60)
* [ee4225fe](https://github.com/hyperledger/fabric-sdk-node/commit/ee4225fe) [FABN-1347](https://jira.hyperledger.org/browse/FABN-1347) NodeSDK update low level (#59)
* [0c2f5201](https://github.com/hyperledger/fabric-sdk-node/commit/0c2f5201) Remove redundant jenkins scripts (#58)
* [67365b5e](https://github.com/hyperledger/fabric-sdk-node/commit/67365b5e) Create eslint task Ahead of the changes for [FABN-1039: - Create eslint npm script - Fix eslint errors, disable some - Ensure all modules eslintignore files extend the top level eslintignore - Ensure fabric-](https://jira.hyperledger.org/browse/FABN-1039: - Create eslint npm script - Fix eslint errors, disable some - Ensure all modules eslintignore files extend the top level eslintignore - Ensure fabric-)client/test/data is excluded from tslint
* [a5f78e74](https://github.com/hyperledger/fabric-sdk-node/commit/a5f78e74) [[FAB-1307](https://jira.hyperledger.org/browse/FAB-1307)] Pass options.unregister through to clientOptions.unregister (#53)
* [583e9025](https://github.com/hyperledger/fabric-sdk-node/commit/583e9025) [[FABN-1407](https://jira.hyperledger.org/browse/FABN-1407)] Add PDC and EP types (#38)
* [9e9ec9e2](https://github.com/hyperledger/fabric-sdk-node/commit/9e9ec9e2) [[FABN-1342](https://jira.hyperledger.org/browse/FABN-1342)] Improve SDK packaging performance (#47)
* [cf63bccc](https://github.com/hyperledger/fabric-sdk-node/commit/cf63bccc) Port relevant changes from PR#33 (#50)
* [014e65bf](https://github.com/hyperledger/fabric-sdk-node/commit/014e65bf) (Master) Remove gerrit/jenkins references (#48)
* [b4b04ade](https://github.com/hyperledger/fabric-sdk-node/commit/b4b04ade) [FABN-1386](https://jira.hyperledger.org/browse/FABN-1386): Doc publishing fixes (#40)
* [fb171122](https://github.com/hyperledger/fabric-sdk-node/commit/fb171122) [FABN-1424](https://jira.hyperledger.org/browse/FABN-1424): Fix lifecycle scenario tests (#46)
* [99c22279](https://github.com/hyperledger/fabric-sdk-node/commit/99c22279) [FABN-1386: Publish docs to gh-](https://jira.hyperledger.org/browse/FABN-1386: Publish docs to gh-)pages branch
* [2815f6d9](https://github.com/hyperledger/fabric-sdk-node/commit/2815f6d9) [[FABN-1393] Pass baseDir/gopath from client to node-](https://jira.hyperledger.org/browse/FABN-1393] Pass baseDir/gopath from client to node-)sdk
* [cce8f1cd](https://github.com/hyperledger/fabric-sdk-node/commit/cce8f1cd) Defang Stalebot
* [e41f3b20](https://github.com/hyperledger/fabric-sdk-node/commit/e41f3b20) [FABN-1415](https://jira.hyperledger.org/browse/FABN-1415) NodeSDK update protos
* [ca321d1d](https://github.com/hyperledger/fabric-sdk-node/commit/ca321d1d) [FABN-1386](https://jira.hyperledger.org/browse/FABN-1386): Azure Pipelines publish of npm packages
* [eeebb171](https://github.com/hyperledger/fabric-sdk-node/commit/eeebb171) [FABN-1413](https://jira.hyperledger.org/browse/FABN-1413) NodeSDK addCommitter fails
* [9a38da6c](https://github.com/hyperledger/fabric-sdk-node/commit/9a38da6c) [FABN-1386](https://jira.hyperledger.org/browse/FABN-1386): Publish API documentation in Azure
* [316a1748](https://github.com/hyperledger/fabric-sdk-node/commit/316a1748) [[FAB-1394]Fabric-](https://jira.hyperledger.org/browse/FAB-1394]Fabric-)merge gulp task
* [19c90973](https://github.com/hyperledger/fabric-sdk-node/commit/19c90973) [[FABN-1396] Deprecate js-](https://jira.hyperledger.org/browse/FABN-1396] Deprecate js-)scenario
* [07c2a183](https://github.com/hyperledger/fabric-sdk-node/commit/07c2a183) [[FABN-1396](https://jira.hyperledger.org/browse/FABN-1396)] convert base endorse scenario test
* [0cfb0a32](https://github.com/hyperledger/fabric-sdk-node/commit/0cfb0a32) [[FABN-1396](https://jira.hyperledger.org/browse/FABN-1396)] update readme
* [463c8ee7](https://github.com/hyperledger/fabric-sdk-node/commit/463c8ee7) [FABN-1386](https://jira.hyperledger.org/browse/FABN-1386): Azure pipelines build
* [6ea632c1](https://github.com/hyperledger/fabric-sdk-node/commit/6ea632c1) [[FABN-1396](https://jira.hyperledger.org/browse/FABN-1396)] hoist typescript tests to cucumber
* [39b44e00](https://github.com/hyperledger/fabric-sdk-node/commit/39b44e00) [FABN-1386](https://jira.hyperledger.org/browse/FABN-1386): TSLint and Docker image fixes
* [982cf3af](https://github.com/hyperledger/fabric-sdk-node/commit/982cf3af) [[FABN-1396](https://jira.hyperledger.org/browse/FABN-1396)] Move typescript tests into scenario
* [104ecd53](https://github.com/hyperledger/fabric-sdk-node/commit/104ecd53) [[FAB-1390](https://jira.hyperledger.org/browse/FAB-1390)] Move tape util file
* [12f43350](https://github.com/hyperledger/fabric-sdk-node/commit/12f43350) [FABN-1407](https://jira.hyperledger.org/browse/FABN-1407) NodeSDK update low level
* [03f6bbf1](https://github.com/hyperledger/fabric-sdk-node/commit/03f6bbf1) [FAB-16778](https://jira.hyperledger.org/browse/FAB-16778) Update baseimage ver to 0.4.16
* [aff09826](https://github.com/hyperledger/fabric-sdk-node/commit/aff09826) [[FABN-1135](https://jira.hyperledger.org/browse/FABN-1135)] Remove nodechaincode
* [b11008e0](https://github.com/hyperledger/fabric-sdk-node/commit/b11008e0) [[FABN-1396](https://jira.hyperledger.org/browse/FABN-1396)] Convert events feature test to typescript
* [bb5cad23](https://github.com/hyperledger/fabric-sdk-node/commit/bb5cad23) [FABN-1403](https://jira.hyperledger.org/browse/FABN-1403) NodeSDK check multiple certs
* [d1be5431](https://github.com/hyperledger/fabric-sdk-node/commit/d1be5431) [[FAB-1395](https://jira.hyperledger.org/browse/FAB-1395)] Improve coverage reporting
* [39ec9fa1](https://github.com/hyperledger/fabric-sdk-node/commit/39ec9fa1) [[FABN-1391](https://jira.hyperledger.org/browse/FABN-1391)] Remove tape unit tests
* [7422cfa8](https://github.com/hyperledger/fabric-sdk-node/commit/7422cfa8) [[FABN-1402](https://jira.hyperledger.org/browse/FABN-1402)] Use "for of" instead of "for in"
* [8c7d395d](https://github.com/hyperledger/fabric-sdk-node/commit/8c7d395d) [[FABN-1396](https://jira.hyperledger.org/browse/FABN-1396)] remove unrequired tape tests
* [424dae77](https://github.com/hyperledger/fabric-sdk-node/commit/424dae77) [[FABN-1397] add ts-](https://jira.hyperledger.org/browse/FABN-1397] add ts-)cucumber test suite
* [b7ce0733](https://github.com/hyperledger/fabric-sdk-node/commit/b7ce0733) [FABN-1347](https://jira.hyperledger.org/browse/FABN-1347) NodeSDK add new low level tests
* [df43b855](https://github.com/hyperledger/fabric-sdk-node/commit/df43b855) [FABN-626](https://jira.hyperledger.org/browse/FABN-626) Make pkcs11js optional
* [5834c7d5](https://github.com/hyperledger/fabric-sdk-node/commit/5834c7d5) [FABN-1391](https://jira.hyperledger.org/browse/FABN-1391)] Refactor cryptosuite tape UT
* [70ce950d](https://github.com/hyperledger/fabric-sdk-node/commit/70ce950d) [FABN-1333](https://jira.hyperledger.org/browse/FABN-1333) improve error message
* [5b012027](https://github.com/hyperledger/fabric-sdk-node/commit/5b012027) [FABN-1347](https://jira.hyperledger.org/browse/FABN-1347) NodeSDK add new lowlevel
* [d826d155](https://github.com/hyperledger/fabric-sdk-node/commit/d826d155) [[FABN-1276](https://jira.hyperledger.org/browse/FABN-1276)] Update ConnectOptions type
* [067b6274](https://github.com/hyperledger/fabric-sdk-node/commit/067b6274) [[FABN-1335]-](https://jira.hyperledger.org/browse/FABN-1335]-)Reference event handling
* [73405acc](https://github.com/hyperledger/fabric-sdk-node/commit/73405acc) [[FABN-1280](https://jira.hyperledger.org/browse/FABN-1280)] Support gencrl in revoke
* [b45430e3](https://github.com/hyperledger/fabric-sdk-node/commit/b45430e3) [[FABN-1391](https://jira.hyperledger.org/browse/FABN-1391)] Initial removal of tape unit tests
* [3e86242f](https://github.com/hyperledger/fabric-sdk-node/commit/3e86242f) [FABN-1388](https://jira.hyperledger.org/browse/FABN-1388) NodeSDK add compile
* [2230ac7f](https://github.com/hyperledger/fabric-sdk-node/commit/2230ac7f) [[FABN-1301](https://jira.hyperledger.org/browse/FABN-1301)] Fix a shell for getting Nexus's image
* [fc6f92c7](https://github.com/hyperledger/fabric-sdk-node/commit/fc6f92c7) [IN-68] Add default GitHub SECURITY policy
* [e9e8c593](https://github.com/hyperledger/fabric-sdk-node/commit/e9e8c593) [FABN-1387: Fix fabric-](https://jira.hyperledger.org/browse/FABN-1387: Fix fabric-)network TypeScript definitions
* [223d1239](https://github.com/hyperledger/fabric-sdk-node/commit/223d1239) [[FABN-1140](https://jira.hyperledger.org/browse/FABN-1140)] Migrate UT to mocha: BasicCommitHandler
* [59afabc3](https://github.com/hyperledger/fabric-sdk-node/commit/59afabc3) [FABN-1345](https://jira.hyperledger.org/browse/FABN-1345) NodeSDK Add DeliverWithPrivateData support
* [70a92348](https://github.com/hyperledger/fabric-sdk-node/commit/70a92348) [FABN-1384](https://jira.hyperledger.org/browse/FABN-1384) NodeSDK udpate grpc levels
* [00aaa8a7](https://github.com/hyperledger/fabric-sdk-node/commit/00aaa8a7) [FABN-1353](https://jira.hyperledger.org/browse/FABN-1353): New wallet implementation
* [535cb809](https://github.com/hyperledger/fabric-sdk-node/commit/535cb809) [[FABN-1378](https://jira.hyperledger.org/browse/FABN-1378)] Increase chaincode execute timeout
* [7ade43cc](https://github.com/hyperledger/fabric-sdk-node/commit/7ade43cc) [FABN-1378](https://jira.hyperledger.org/browse/FABN-1378) NodeSDK Lifecycle timeout
* [38daed68](https://github.com/hyperledger/fabric-sdk-node/commit/38daed68) [[FABN-1383](https://jira.hyperledger.org/browse/FABN-1383)] Remove token docs for node.js sdk
* [4b90dec1](https://github.com/hyperledger/fabric-sdk-node/commit/4b90dec1) [FABN-1379: Cleanup of identity-](https://jira.hyperledger.org/browse/FABN-1379: Cleanup of identity-)service tests
* [22571511](https://github.com/hyperledger/fabric-sdk-node/commit/22571511) [FABN-1379 NodeSDK fabric-ca-](https://jira.hyperledger.org/browse/FABN-1379 NodeSDK fabric-ca-)client test fix
* [be894cb0](https://github.com/hyperledger/fabric-sdk-node/commit/be894cb0) [[FABN-1379](https://jira.hyperledger.org/browse/FABN-1379)] Gradle updates for E2E tests
* [35edb795](https://github.com/hyperledger/fabric-sdk-node/commit/35edb795) [[FABN-1379](https://jira.hyperledger.org/browse/FABN-1379)] Fix certificate service tests
* [c24a331a](https://github.com/hyperledger/fabric-sdk-node/commit/c24a331a) [[FABN-1379](https://jira.hyperledger.org/browse/FABN-1379)] Fix dodgy E2E chaincode example_cc1++
* [a2f1d7fb](https://github.com/hyperledger/fabric-sdk-node/commit/a2f1d7fb) [[FABN-1379](https://jira.hyperledger.org/browse/FABN-1379)] Fix dodgy E2E chaincode example_cc1
* [13e8a8ee](https://github.com/hyperledger/fabric-sdk-node/commit/13e8a8ee) [[FABN-1379](https://jira.hyperledger.org/browse/FABN-1379)] Timing problems in packaging UT
* [1a4f1910](https://github.com/hyperledger/fabric-sdk-node/commit/1a4f1910) Add packaging support for go module chaincode
* [0a273c9b](https://github.com/hyperledger/fabric-sdk-node/commit/0a273c9b) Vendor package dependencies for go chaincode
* [e6cfcfe0](https://github.com/hyperledger/fabric-sdk-node/commit/e6cfcfe0) [[FAB-16489](https://jira.hyperledger.org/browse/FAB-16489)] Add CODEOWNERS
* [130173b4](https://github.com/hyperledger/fabric-sdk-node/commit/130173b4) [[FABN-1359](https://jira.hyperledger.org/browse/FABN-1359)] Move HSM docs into separated page
* [3493d67d](https://github.com/hyperledger/fabric-sdk-node/commit/3493d67d) Use patch-package instead of sed
* [be841fea](https://github.com/hyperledger/fabric-sdk-node/commit/be841fea) Use github.com/hyperledger/fabric-protos repo
* [b06fda46](https://github.com/hyperledger/fabric-sdk-node/commit/b06fda46) [FABN-1348](https://jira.hyperledger.org/browse/FABN-1348) NodeSDK allow targets with discovery
* [6418070b](https://github.com/hyperledger/fabric-sdk-node/commit/6418070b) [FAB-16290](https://jira.hyperledger.org/browse/FAB-16290) Make metadata fields lower case
* [c75dc252](https://github.com/hyperledger/fabric-sdk-node/commit/c75dc252) [[FABN-1354](https://jira.hyperledger.org/browse/FABN-1354)] Remove token code from Node.js SDK
* [54be4c55](https://github.com/hyperledger/fabric-sdk-node/commit/54be4c55) [[FABCI-395](https://jira.hyperledger.org/browse/FABCI-395)] Remove AnsiColor wrapper
* [fbad794a](https://github.com/hyperledger/fabric-sdk-node/commit/fbad794a) [[FABN-1350] enhance network-](https://jira.hyperledger.org/browse/FABN-1350] enhance network-)config tutorial
* [79b528a9](https://github.com/hyperledger/fabric-sdk-node/commit/79b528a9) [FABN-1349](https://jira.hyperledger.org/browse/FABN-1349) NodeSDK set init on lifecycle test
* [61064c62](https://github.com/hyperledger/fabric-sdk-node/commit/61064c62) [FABN-1344](https://jira.hyperledger.org/browse/FABN-1344): Allow endorsing peers to be specified
* [a4c8390b](https://github.com/hyperledger/fabric-sdk-node/commit/a4c8390b) [FAB-15821](https://jira.hyperledger.org/browse/FAB-15821) NodeSDK new lifecycle queries
* [e0b4b83a](https://github.com/hyperledger/fabric-sdk-node/commit/e0b4b83a) [FABN-1233](https://jira.hyperledger.org/browse/FABN-1233) NodeSDK segfault
* [83f7aac9](https://github.com/hyperledger/fabric-sdk-node/commit/83f7aac9) [FABN-1325](https://jira.hyperledger.org/browse/FABN-1325) NodeSDK readme update
* [14686caa](https://github.com/hyperledger/fabric-sdk-node/commit/14686caa) [FABN-1233](https://jira.hyperledger.org/browse/FABN-1233) NodeSDK segfault
* [ee4052ce](https://github.com/hyperledger/fabric-sdk-node/commit/ee4052ce) [FAB-16166](https://jira.hyperledger.org/browse/FAB-16166) Switch to metadata.json for packaging
* [f7c7cc89](https://github.com/hyperledger/fabric-sdk-node/commit/f7c7cc89) [FABN-669](https://jira.hyperledger.org/browse/FABN-669) NodeSDK Lifecycle support
* [be1cb8b3](https://github.com/hyperledger/fabric-sdk-node/commit/be1cb8b3) [[FABN-1340](https://jira.hyperledger.org/browse/FABN-1340)] Fix typos and deadlinks in documents
* [9761dce9](https://github.com/hyperledger/fabric-sdk-node/commit/9761dce9) [FABN-1233](https://jira.hyperledger.org/browse/FABN-1233) NodeSDK segfault
* [53f51c26](https://github.com/hyperledger/fabric-sdk-node/commit/53f51c26) [FABN-1336](https://jira.hyperledger.org/browse/FABN-1336) NodeSDK typescript test fails
* [54d230b2](https://github.com/hyperledger/fabric-sdk-node/commit/54d230b2) [FABN-1332](https://jira.hyperledger.org/browse/FABN-1332): Revert commit handler implementation
* [6a7e5ef5](https://github.com/hyperledger/fabric-sdk-node/commit/6a7e5ef5) [FAB-16166](https://jira.hyperledger.org/browse/FAB-16166) Standardize _lifecycle code package name
* [5ff2e190](https://github.com/hyperledger/fabric-sdk-node/commit/5ff2e190) [FABN-1326](https://jira.hyperledger.org/browse/FABN-1326): Use only eventing peers for commits
* [950b81f7](https://github.com/hyperledger/fabric-sdk-node/commit/950b81f7) [FABN-1331](https://jira.hyperledger.org/browse/FABN-1331)
* [58c70b53](https://github.com/hyperledger/fabric-sdk-node/commit/58c70b53) [FABN-1321](https://jira.hyperledger.org/browse/FABN-1321) Validate boolean type value of Config
* [b51f12a7](https://github.com/hyperledger/fabric-sdk-node/commit/b51f12a7) [FABN-1322](https://jira.hyperledger.org/browse/FABN-1322): JSDoc for DefaultEventHandlerStrategies
* [e4c1d5a0](https://github.com/hyperledger/fabric-sdk-node/commit/e4c1d5a0) [[FABN-1318](https://jira.hyperledger.org/browse/FABN-1318)] not to split word by link
* [5d1a88bf](https://github.com/hyperledger/fabric-sdk-node/commit/5d1a88bf) [[FABN-1314](https://jira.hyperledger.org/browse/FABN-1314)]
* [7634660a](https://github.com/hyperledger/fabric-sdk-node/commit/7634660a) [[FABN-1302](https://jira.hyperledger.org/browse/FABN-1302)] Added filtered block
* [c19bb33d](https://github.com/hyperledger/fabric-sdk-node/commit/c19bb33d) [FABN-1303](https://jira.hyperledger.org/browse/FABN-1303) Update to version 1.21 of grpc
* [54409b61](https://github.com/hyperledger/fabric-sdk-node/commit/54409b61) [FABN-1304](https://jira.hyperledger.org/browse/FABN-1304) NodeSDK disable new lifecycle test
* [021cdf78](https://github.com/hyperledger/fabric-sdk-node/commit/021cdf78) [FABN-1288](https://jira.hyperledger.org/browse/FABN-1288) NodeSDK remove clientKey from log
* [bd9d3093](https://github.com/hyperledger/fabric-sdk-node/commit/bd9d3093) [FAB-15821](https://jira.hyperledger.org/browse/FAB-15821) NodeSDK prepare for lifecycle changes
* [fe56f257](https://github.com/hyperledger/fabric-sdk-node/commit/fe56f257) [[FABN-1251](https://jira.hyperledger.org/browse/FABN-1251)] Added start/end block functionality
* [d86d83b8](https://github.com/hyperledger/fabric-sdk-node/commit/d86d83b8) [[FABN-1274](https://jira.hyperledger.org/browse/FABN-1274)] enhance gateway doc
* [0b885e1a](https://github.com/hyperledger/fabric-sdk-node/commit/0b885e1a) [[FABN-1203] fabric-](https://jira.hyperledger.org/browse/FABN-1203] fabric-)network event listening doc changes
* [be3df228](https://github.com/hyperledger/fabric-sdk-node/commit/be3df228) [FABN-1259](https://jira.hyperledger.org/browse/FABN-1259) fix timeout when debugging chaincode
* [1e28d1bc](https://github.com/hyperledger/fabric-sdk-node/commit/1e28d1bc) [FABN-1265](https://jira.hyperledger.org/browse/FABN-1265) NodeSDK remove logging go chaincode
* [3fbe8cd3](https://github.com/hyperledger/fabric-sdk-node/commit/3fbe8cd3) [[FABN-1180](https://jira.hyperledger.org/browse/FABN-1180)] Simplify initial user experience
* [36fbdc68](https://github.com/hyperledger/fabric-sdk-node/commit/36fbdc68) [FABN-1256](https://jira.hyperledger.org/browse/FABN-1256) NodeSDK reset as_local default
* [c9285c58](https://github.com/hyperledger/fabric-sdk-node/commit/c9285c58) [FABN-1220 NodeSDK add fabric-ca-](https://jira.hyperledger.org/browse/FABN-1220 NodeSDK add fabric-ca-)client
* [10caad4b](https://github.com/hyperledger/fabric-sdk-node/commit/10caad4b) [FABN-1133](https://jira.hyperledger.org/browse/FABN-1133) NodeSDK switch to caname
* [bdfdf785](https://github.com/hyperledger/fabric-sdk-node/commit/bdfdf785) [FABN-1260](https://jira.hyperledger.org/browse/FABN-1260) NodeSDK have fixed typescript
* [200b8622](https://github.com/hyperledger/fabric-sdk-node/commit/200b8622) [FABN-401](https://jira.hyperledger.org/browse/FABN-401) NodeSDK update connect link
* [60d160db](https://github.com/hyperledger/fabric-sdk-node/commit/60d160db) [[FABN-1257](https://jira.hyperledger.org/browse/FABN-1257)] Fix EventHub error when reconnecting
* [309dc104](https://github.com/hyperledger/fabric-sdk-node/commit/309dc104) [[FABN-1254](https://jira.hyperledger.org/browse/FABN-1254)] Fix Chaincode's label for the validation
* [38402b27](https://github.com/hyperledger/fabric-sdk-node/commit/38402b27) [FABN-401](https://jira.hyperledger.org/browse/FABN-401) NodeSDK add chaincode event note
* [51509d4a](https://github.com/hyperledger/fabric-sdk-node/commit/51509d4a) [FABN-1208](https://jira.hyperledger.org/browse/FABN-1208) NodeSDK add release notes section
* [d693bc3f](https://github.com/hyperledger/fabric-sdk-node/commit/d693bc3f) [FABN-1239](https://jira.hyperledger.org/browse/FABN-1239): Better error on submitTransaction failure
* [96afa090](https://github.com/hyperledger/fabric-sdk-node/commit/96afa090) [FABN-1238](https://jira.hyperledger.org/browse/FABN-1238) NodeSDK Add chaincode cnstr
* [9b1f7155](https://github.com/hyperledger/fabric-sdk-node/commit/9b1f7155) [[FABN-1235](https://jira.hyperledger.org/browse/FABN-1235)] Block event checkpointer fix
* [661b6a2c](https://github.com/hyperledger/fabric-sdk-node/commit/661b6a2c) [[FABN-1180](https://jira.hyperledger.org/browse/FABN-1180)] readme typo
* [11b1ad24](https://github.com/hyperledger/fabric-sdk-node/commit/11b1ad24) [FABN-1238](https://jira.hyperledger.org/browse/FABN-1238) NodeSDK add lifecycle ts
* [6296c5d1](https://github.com/hyperledger/fabric-sdk-node/commit/6296c5d1) [[FABN-1205](https://jira.hyperledger.org/browse/FABN-1205)] Chaincode event data fix
* [4d5ff985](https://github.com/hyperledger/fabric-sdk-node/commit/4d5ff985) [FABN-1238](https://jira.hyperledger.org/browse/FABN-1238) NodeSDK add TS for lifecycle
* [14dd4ac8](https://github.com/hyperledger/fabric-sdk-node/commit/14dd4ac8) [FABN-1231](https://jira.hyperledger.org/browse/FABN-1231) NodeSDK add connect to event tutorial
* [31b20842](https://github.com/hyperledger/fabric-sdk-node/commit/31b20842) [FABN-1226](https://jira.hyperledger.org/browse/FABN-1226): Better handling of query error responses
* [c3f95cc5](https://github.com/hyperledger/fabric-sdk-node/commit/c3f95cc5) [[FABN-1225](https://jira.hyperledger.org/browse/FABN-1225)] Convert CDS path seps from Win to UNIX
* [21dcf963](https://github.com/hyperledger/fabric-sdk-node/commit/21dcf963) [[FABN-1100](https://jira.hyperledger.org/browse/FABN-1100)] Fix for checkpoint factory
* [5a361ae6](https://github.com/hyperledger/fabric-sdk-node/commit/5a361ae6) [FABN-1210](https://jira.hyperledger.org/browse/FABN-1210) NodeSDK Chaincode events as array
* [a9f082c0](https://github.com/hyperledger/fabric-sdk-node/commit/a9f082c0) [[FABN-1219](https://jira.hyperledger.org/browse/FABN-1219)] Convert FabricCAClient.js to ES6 syntax.
* [71e371bb](https://github.com/hyperledger/fabric-sdk-node/commit/71e371bb) [[FABN-1216](https://jira.hyperledger.org/browse/FABN-1216)] package.json add node 10
* [936a78c8](https://github.com/hyperledger/fabric-sdk-node/commit/936a78c8) [#[FABN-1206](https://jira.hyperledger.org/browse/FABN-1206)] Fixed inability to receive filtered events
* [686aec35](https://github.com/hyperledger/fabric-sdk-node/commit/686aec35) [FABN-1215](https://jira.hyperledger.org/browse/FABN-1215) Fix license statements
* [28fa7947](https://github.com/hyperledger/fabric-sdk-node/commit/28fa7947) [FAB-14999](https://jira.hyperledger.org/browse/FAB-14999) NodeSDK prepare for v2.0.0
* [126175c9](https://github.com/hyperledger/fabric-sdk-node/commit/126175c9) [FABN-1207](https://jira.hyperledger.org/browse/FABN-1207) NodeSDK chaincode event defaults


## v2.0.0-alpha
Thu Apr 11 21:30:29 EDT 2019

* [749ef4b](https://github.com/hyperledger/fabric-sdk-node/commit/749ef4b) [FABN-1209](https://jira.hyperledger.org/browse/FABN-1209) NodeSDK publish 2.0.0-alpha
* [4477662](https://github.com/hyperledger/fabric-sdk-node/commit/4477662) [FABN-669](https://jira.hyperledger.org/browse/FAB-669) NodeSDK Lifecycle update doc
* [3ede757](https://github.com/hyperledger/fabric-sdk-node/commit/3ede757) [FABN-1198](https://jira.hyperledger.org/browse/FABN-1198) update chaincode tutorial
* [82efdf2](https://github.com/hyperledger/fabric-sdk-node/commit/82efdf2) [FABN-669](https://jira.hyperledger.org/browse/FABN-669) NodeSDK remove proto
* [d6b9cb1](https://github.com/hyperledger/fabric-sdk-node/commit/d6b9cb1) [FABN-1201](https://jira.hyperledger.org/browse/FABN-1201) NodeSDK fix SO_TIMEOUT error
* [d950dbb](https://github.com/hyperledger/fabric-sdk-node/commit/d950dbb) [FABN-1202](https://jira.hyperledger.org/browse/FABN-1202) NodeSDK missig elliptic dependency
* [4caa310](https://github.com/hyperledger/fabric-sdk-node/commit/4caa310) [FABN-669](https://jira.hyperledger.org/browse/FABN-669) NodeSDK Lifecycle part 2
* [f7395bc](https://github.com/hyperledger/fabric-sdk-node/commit/f7395bc) [FABN-1199](https://jira.hyperledger.org/browse/FABN-1199) Update the link to FabToken doc
* [7feb93a](https://github.com/hyperledger/fabric-sdk-node/commit/7feb93a) [FABN-909](https://jira.hyperledger.org/browse/FABN-909) remove duplicated npm dependencies
* [ffa998a](https://github.com/hyperledger/fabric-sdk-node/commit/ffa998a) [FABN-1199](https://jira.hyperledger.org/browse/FABN-1199) Simplify token owner parameter
* [54e6d64](https://github.com/hyperledger/fabric-sdk-node/commit/54e6d64) [FABN-1197](https://jira.hyperledger.org/browse/FABN-1197) Update token e2e tests
* [dd80be9](https://github.com/hyperledger/fabric-sdk-node/commit/dd80be9) [FABN-1100](https://jira.hyperledger.org/browse/FABN-1100) Tidy start block and event hub management
* [4555441](https://github.com/hyperledger/fabric-sdk-node/commit/4555441) [FABN-909] (https://jira.hyperledger.org/browse/FABN-909) remove unused fabric-ca-)client files
* [5f7f720](https://github.com/hyperledger/fabric-sdk-node/commit/5f7f720) [FABN-1183](https://jira.hyperledger.org/browse/FABN-1183) Update token tutorial and js doc
* [9ffc037](https://github.com/hyperledger/fabric-sdk-node/commit/9ffc037) [FABN-1100](https://jira.hyperledger.org/browse/FABN-1100) Checkpoint after callback is complete
* [53359f9](https://github.com/hyperledger/fabric-sdk-node/commit/53359f9) [FABN-1194](https://jira.hyperledger.org/browse/FABN-1194) Use connection options for discovery peer
* [3124710](https://github.com/hyperledger/fabric-sdk-node/commit/3124710) [FABN-1100](https://jira.hyperledger.org/browse/FABN-1100) Ammended typescript definitions
* [d307ee1](https://github.com/hyperledger/fabric-sdk-node/commit/d307ee1) [FABN-1100](https://jira.hyperledger.org/browse/FABN-1100) Event handling abstractions
* [344e71d](https://github.com/hyperledger/fabric-sdk-node/commit/344e71d) [FABN-1186](https://jira.hyperledger.org/browse/FABN-1186) GRPC level update
* [0f727cb](https://github.com/hyperledger/fabric-sdk-node/commit/0f727cb) [FABN-1190] update npm js-](https://jira.hyperledger.org/browse/FABN-1190] update npm js-)yaml:3.13.0
* [0a95259](https://github.com/hyperledger/fabric-sdk-node/commit/0a95259) [FABN-1193](https://jira.hyperledger.org/browse/FABN-1193) Update CI Scripts
* [e22b316](https://github.com/hyperledger/fabric-sdk-node/commit/e22b316) [FABN-1155](https://jira.hyperledger.org/browse/FABN-1155) Include missed connection setting
* [1a7a53f](https://github.com/hyperledger/fabric-sdk-node/commit/1a7a53f) Properly handle empty responses
* [7bcf8f8](https://github.com/hyperledger/fabric-sdk-node/commit/7bcf8f8) [FABCI-304](https://jira.hyperledger.org/browse/FABCI-304) Update CI Pipeline script
* [79f80e7](https://github.com/hyperledger/fabric-sdk-node/commit/79f80e7) [FABN-1188](https://jira.hyperledger.org/browse/FABN-1188) Update thirdparty version to 0.4.15
* [cc8b4de](https://github.com/hyperledger/fabric-sdk-node/commit/cc8b4de) [FABN-1183](https://jira.hyperledger.org/browse/FABN-1183) Update fabtoken tutorial
* [8dc6bc0](https://github.com/hyperledger/fabric-sdk-node/commit/8dc6bc0) [FABN-1183](https://jira.hyperledger.org/browse/FABN-1183) Update quantity to be decimal string
* [c448406](https://github.com/hyperledger/fabric-sdk-node/commit/c448406) [FABN-1181](https://jira.hyperledger.org/browse/FABN-1181) Make token.js e2e self contained
* [96c54d6](https://github.com/hyperledger/fabric-sdk-node/commit/96c54d6) [FABN-870](https://jira.hyperledger.org/browse/FABN-870)] minor jsdoc fix in channel.js
* [1dcaf55](https://github.com/hyperledger/fabric-sdk-node/commit/1dcaf55) [FABN-1153](https://jira.hyperledger.org/browse/FABN-1153) Add BasicProverHandler
* [ebde2da](https://github.com/hyperledger/fabric-sdk-node/commit/ebde2da) [FABN-1181](https://jira.hyperledger.org/browse/FABN-1181) Sync up v2 channel config subdir
* [d9c5ab8](https://github.com/hyperledger/fabric-sdk-node/commit/d9c5ab8) [FABN-1179](https://jira.hyperledger.org/browse/FABN-1179) Move debug log in CI
* [9e3d585](https://github.com/hyperledger/fabric-sdk-node/commit/9e3d585) [FABN-1177](https://jira.hyperledger.org/browse/FABN-1177) Add gulp end-to-)end test for fabric
* [07afaa7](https://github.com/hyperledger/fabric-sdk-node/commit/07afaa7) [FABN-1154](https://jira.hyperledger.org/browse/FABN-1154) FabToken tutorial
* [88e0e10](https://github.com/hyperledger/fabric-sdk-node/commit/88e0e10) [FABN-1147](https://jira.hyperledger.org/browse/FABN-1147) update lic_check ignore list
* [44a8b17](https://github.com/hyperledger/fabric-sdk-node/commit/44a8b17) [FABN-1176](https://jira.hyperledger.org/browse/FABN-1176) Fix Mac crypto generation scripts
* [7260b5d](https://github.com/hyperledger/fabric-sdk-node/commit/7260b5d) [FABN-1175](https://jira.hyperledger.org/browse/FABN-1175) Move test temp directory
* [e2fd26c](https://github.com/hyperledger/fabric-sdk-node/commit/e2fd26c) [FABN-1154](https://jira.hyperledger.org/browse/FABN-1154) Fix javascript doc error
* [5869b9a](https://github.com/hyperledger/fabric-sdk-node/commit/5869b9a) [FABN-1174](https://jira.hyperledger.org/browse/FABN-1174) KeyValue store and cryptosuite changes
* [3ba4574](https://github.com/hyperledger/fabric-sdk-node/commit/3ba4574) [FABN-1173](https://jira.hyperledger.org/browse/FABN-1173) update readme files
* [87b902b](https://github.com/hyperledger/fabric-sdk-node/commit/87b902b) [FABN-1169](https://jira.hyperledger.org/browse/FABN-1169] auto-)gen test certs in build
* [9df0b25](https://github.com/hyperledger/fabric-sdk-node/commit/9df0b25) [FABN-1169](https://jira.hyperledger.org/browse/FABN-1169) add to lic check list
* [9e3fe1b](https://github.com/hyperledger/fabric-sdk-node/commit/9e3fe1b) [FABN-1169](https://jira.hyperledger.org/browse/FABN-1169) modify fixtures folder
* [9a456fc](https://github.com/hyperledger/fabric-sdk-node/commit/9a456fc) [FABN-1169](https://jira.hyperledger.org/browse/FABN-1169) enable client authentication
* [0a58cf5](https://github.com/hyperledger/fabric-sdk-node/commit/0a58cf5) [FABN-1162](https://jira.hyperledger.org/browse/FABN-1162) Add decodeTokenTransaction
* [f12d5f5](https://github.com/hyperledger/fabric-sdk-node/commit/f12d5f5) [FABN-1163](https://jira.hyperledger.org/browse/FABN-1163) Update token support with latest proto msgs
* [602f557](https://github.com/hyperledger/fabric-sdk-node/commit/602f557) [FABN-943](https://jira.hyperledger.org/browse/FABN-943) NodeSDK fabric-ca add authtoken
* [0d13dff](https://github.com/hyperledger/fabric-sdk-node/commit/0d13dff) [FABN-1161](https://jira.hyperledger.org/browse/FABN-1161) Use the configSetting when channel init.
* [14eb52e](https://github.com/hyperledger/fabric-sdk-node/commit/14eb52e) [FABN-1117](https://jira.hyperledger.org/browse/FABN-1117) NodeSDK Add reconnect tutorial
* [c3b884b](https://github.com/hyperledger/fabric-sdk-node/commit/c3b884b) [FABN-1160](https://jira.hyperledger.org/browse/FABN-1160) Fix TLS logic for discovered peers
* [847d2da](https://github.com/hyperledger/fabric-sdk-node/commit/847d2da) [FABN-1169](https://jira.hyperledger.org/browse/FABN-1169) script cert generation
* [2b14610](https://github.com/hyperledger/fabric-sdk-node/commit/2b14610) [FABN-1149](https://jira.hyperledger.org/browse/FABN-1149) NodeSDK: token e2e tests
* [e3e176f](https://github.com/hyperledger/fabric-sdk-node/commit/e3e176f) [FABN-1154](https://jira.hyperledger.org/browse/FABN-1154) Fix javascript doc error
* [ab95f19](https://github.com/hyperledger/fabric-sdk-node/commit/ab95f19) [FABN-1158](https://jira.hyperledger.org/browse/FABN-1158) Fix CouchDB Wallet delete key
* [2ee102a](https://github.com/hyperledger/fabric-sdk-node/commit/2ee102a) [FABN-1159](https://jira.hyperledger.org/browse/FABN-1159) Allow PEM paths relative to CCP
* [dfda1e9](https://github.com/hyperledger/fabric-sdk-node/commit/dfda1e9) [FABN-682](https://jira.hyperledger.org/browse/FABN-682) NodeSDK  client specify escc/vscc names
* [3ef429f](https://github.com/hyperledger/fabric-sdk-node/commit/3ef429f) [FABN-1157](https://jira.hyperledger.org/browse/FABN-1157) Update to latest token proto messages
* [83846e5](https://github.com/hyperledger/fabric-sdk-node/commit/83846e5) [FABN-1148](https://jira.hyperledger.org/browse/FABN-1148) Allow offline signer for token (part 2)
* [e29bcd9](https://github.com/hyperledger/fabric-sdk-node/commit/e29bcd9) [FABN-1148](https://jira.hyperledger.org/browse/FABN-1148) Allow offline singer for token
* [6d63c03](https://github.com/hyperledger/fabric-sdk-node/commit/6d63c03) [FABN-1118](https://jira.hyperledger.org/browse/FABN-1118): Unit test fixes for Node 10
* [e1af608](https://github.com/hyperledger/fabric-sdk-node/commit/e1af608) [FABN-1142](https://jira.hyperledger.org/browse/FABN-1142) Node sdk: add token support
* [5256aa2](https://github.com/hyperledger/fabric-sdk-node/commit/5256aa2) [FABN-1152](https://jira.hyperledger.org/browse/FABN-1152) Typos in test/scenario/README.md
* [304da1e](https://github.com/hyperledger/fabric-sdk-node/commit/304da1e) [FABN-1140](https://jira.hyperledger.org/browse/FABN-1140) remove testing of 3rd party lib
* [acd1d95](https://github.com/hyperledger/fabric-sdk-node/commit/acd1d95) [FABN-1140](https://jira.hyperledger.org/browse/FABN-1140) move pkcs and edsca to  mocha
* [3a93082](https://github.com/hyperledger/fabric-sdk-node/commit/3a93082) [FABN-1143](https://jira.hyperledger.org/browse/FABN-1143): Remove spurious error log
* [d3ba24c](https://github.com/hyperledger/fabric-sdk-node/commit/d3ba24c) [FABN-1140](https://jira.hyperledger.org/browse/FABN-1140) Consolidate channel unit tests
* [8ee0f99](https://github.com/hyperledger/fabric-sdk-node/commit/8ee0f99) [FABN-1140](https://jira.hyperledger.org/browse/FABN-1140) remove duplicate unit tests
* [62106bd](https://github.com/hyperledger/fabric-sdk-node/commit/62106bd) [FAB-1163](https://jira.hyperledger.org/browse/FAB-1163) prevent fabric network bounce
* [57b683e](https://github.com/hyperledger/fabric-sdk-node/commit/57b683e) [FABN-1128](https://jira.hyperledger.org/browse/FABN-1128) Discovery options not merged correctly
* [747c621](https://github.com/hyperledger/fabric-sdk-node/commit/747c621) [[FABN-1132](https://jira.hyperledger.org/browse/FABN-1132) Update proto message files
* [fdb6240](https://github.com/hyperledger/fabric-sdk-node/commit/fdb6240) [[FABN-1130](https://jira.hyperledger.org/browse/FABN-1130) Stop using "init" as default function name
* [635a3dc](https://github.com/hyperledger/fabric-sdk-node/commit/635a3dc) [FABN-1031](https://jira.hyperledger.org/browse/FABN-1031): Use fork of x509 dependency
* [735a2f3](https://github.com/hyperledger/fabric-sdk-node/commit/735a2f3) [[FABN-1127](https://jira.hyperledger.org/browse/FABN-1127)] Corrected typescript definitions
* [3919890](https://github.com/hyperledger/fabric-sdk-node/commit/3919890) Upgrade typescript dependency
* [849b85c](https://github.com/hyperledger/fabric-sdk-node/commit/849b85c) [FABN-1131](https://jira.hyperledger.org/browse/FABN-1131) NodeSDK isolate logging test
* [bcedac0](https://github.com/hyperledger/fabric-sdk-node/commit/bcedac0) [FABN-599](https://jira.hyperledger.org/browse/FABN-599 -) Add msp unit test
* [ff63a50](https://github.com/hyperledger/fabric-sdk-node/commit/ff63a50) [FABN-1125](https://jira.hyperledger.org/browse/FABN-1125)
* [3d0c72f](https://github.com/hyperledger/fabric-sdk-node/commit/3d0c72f) [FABN-909](https://jira.hyperledger.org/browse/FABN-909] Move identity classes into fabric-)common
* [dfd1a1d](https://github.com/hyperledger/fabric-sdk-node/commit/dfd1a1d) [FABN-669](https://jira.hyperledger.org/browse/FABN-669) NodeSDK new Chaincode lifecycle
* [8084e55](https://github.com/hyperledger/fabric-sdk-node/commit/8084e55) [FAB-1117](https://jira.hyperledger.org/browse/FAB-1117) NodeSDK event hub connect
* [4de9150](https://github.com/hyperledger/fabric-sdk-node/commit/4de9150) [FABN-1124](https://jira.hyperledger.org/browse/FABN-1124): Use MSP ID from client user context
* [0a85a54](https://github.com/hyperledger/fabric-sdk-node/commit/0a85a54) [FABN-1123](https://jira.hyperledger.org/browse/FABN-1123) Fix identity update maxEnrollments
* [8621a18](https://github.com/hyperledger/fabric-sdk-node/commit/8621a18) [FABN-599](https://jira.hyperledger.org/browse/FABN-599) Split code coverage checks for unit/fv
* [b368e5d](https://github.com/hyperledger/fabric-sdk-node/commit/b368e5d) [FABN-1096](https://jira.hyperledger.org/browse/FABN-1096) NodeSDK add member_only_read/write
* [058d51a](https://github.com/hyperledger/fabric-sdk-node/commit/058d51a) [FABN-1083](https://jira.hyperledger.org/browse/FABN-1083) NodeSDK allow commit/endorse handler
* [317ed37](https://github.com/hyperledger/fabric-sdk-node/commit/317ed37) [FABN-909](https://jira.hyperledger.org/browse/FABN-909] Move hash classes into fabric-)common
* [7703030](https://github.com/hyperledger/fabric-sdk-node/commit/7703030) [[FABN-909](https://jira.hyperledger.org/browse/FABN-909] Use new fabric-)protos module
* [d0711a5](https://github.com/hyperledger/fabric-sdk-node/commit/d0711a5) [FABN-1110](https://jira.hyperledger.org/browse/FABN-1110) Update CI script to remove nvm installation
* [309722a](https://github.com/hyperledger/fabric-sdk-node/commit/309722a) [FAB-1108](https://jira.hyperledger.org/browse/FAB-1108): Sample query handler and tutorial
* [8b4715a](https://github.com/hyperledger/fabric-sdk-node/commit/8b4715a) [FABN-909](https://jira.hyperledger.org/browse/FABN-909] Add new fabric-)protos module
* [07956d6](https://github.com/hyperledger/fabric-sdk-node/commit/07956d6) [FABN-1102](https://jira.hyperledger.org/browse/FABN-1102): MSPID_SCOPE_ROUND_ROBIN query handler
* [91254d2](https://github.com/hyperledger/fabric-sdk-node/commit/91254d2) [FABN-1101](https://jira.hyperledger.org/browse/FABN-1101): MSPID_SCOPE_SINGLE query handler
* [eba2921](https://github.com/hyperledger/fabric-sdk-node/commit/eba2921) [[FABN-599](https://jira.hyperledger.org/browse/FABN-599)] Added more unit tests to the Channel class
* [2a93c9b](https://github.com/hyperledger/fabric-sdk-node/commit/2a93c9b) [FABN-1098](https://jira.hyperledger.org/browse/FABN-1098) NodeSDK allow multiple targets
* [a379135](https://github.com/hyperledger/fabric-sdk-node/commit/a379135) [FABN-1097](https://jira.hyperledger.org/browse/FABN-1097) NodeSDK use class name
* [0fd719d](https://github.com/hyperledger/fabric-sdk-node/commit/0fd719d) [FABN-909](https://jira.hyperledger.org/browse/FABN-909)] Move api.js classes into common package
* [7017582](https://github.com/hyperledger/fabric-sdk-node/commit/7017582) [FAB-13307](https://jira.hyperledger.org/browse/FAB-13307) Added cucumber test that covers discovery
* [21b5001](https://github.com/hyperledger/fabric-sdk-node/commit/21b5001) [FABN-909](https://jira.hyperledger.org/browse/FABN-909) Move Config class into common package
* [6053250](https://github.com/hyperledger/fabric-sdk-node/commit/6053250) [FABN-1058](https://jira.hyperledger.org/browse/FABN-1058) NodeSDK add discover doc
* [66af0c1](https://github.com/hyperledger/fabric-sdk-node/commit/66af0c1) Configure Stale ProBot
* [0972979](https://github.com/hyperledger/fabric-sdk-node/commit/0972979) [FABN-599](https://jira.hyperledger.org/browse/FABN-599) More unit tests for Channel class
* [5f7256f](https://github.com/hyperledger/fabric-sdk-node/commit/5f7256f) [FABN-1085](https://jira.hyperledger.org/browse/FABN-1085): Minor doc corrections
* [2e76f5d](https://github.com/hyperledger/fabric-sdk-node/commit/2e76f5d) [FABN-1084](https://jira.hyperledger.org/browse/FABN-1084) X509 library locked to 0.3.3
* [aa1236a](https://github.com/hyperledger/fabric-sdk-node/commit/aa1236a) [FABN-1069](https://jira.hyperledger.org/browse/FABN-1069): TimeoutError on commit event timeout
* [c9a66e1](https://github.com/hyperledger/fabric-sdk-node/commit/c9a66e1) [FABN-1066](https://jira.hyperledger.org/browse/FABN-1066 NodeSDK Set default docs to release-1).4
* [a4c0fd2](https://github.com/hyperledger/fabric-sdk-node/commit/a4c0fd2) [FABN-1058](https://jira.hyperledger.org/browse/FABN-1058) NodeSDK handler close peer
* [e15c2f5](https://github.com/hyperledger/fabric-sdk-node/commit/e15c2f5) [FABN-1070](https://jira.hyperledger.org/browse/FABN-1070) NodeSDK use node.js 8.14.0
* [89e8c4b](https://github.com/hyperledger/fabric-sdk-node/commit/89e8c4b) [FABN-1058](https://jira.hyperledger.org/browse/FABN-1058) NodeSDK handler close peer
* [54026a4](https://github.com/hyperledger/fabric-sdk-node/commit/54026a4) [FABN-1054](https://jira.hyperledger.org/browse/FABN-1054): Private pool in EventHubFactory
* [ab1e371](https://github.com/hyperledger/fabric-sdk-node/commit/ab1e371) [FABN-1060](https://jira.hyperledger.org/browse/FABN-1060): Handle error responses in comparison
* [cac1354](https://github.com/hyperledger/fabric-sdk-node/commit/cac1354) [FABN-1056](https://jira.hyperledger.org/browse/FABN-1056)] update return type of sign() to Buffer

## v1.4.0-rc1
Tue 11 Dec 2018 09:14:32 GMT

* [3e9ae04](https://github.com/hyperledger/fabric-sdk-node/commit/3e9ae04) [FABN-834](https://jira.hyperledger.org/browse/FABN-834) NodeSDK explain gRPC settings
* [92b70bc](https://github.com/hyperledger/fabric-sdk-node/commit/92b70bc) [FABN-1051](https://jira.hyperledger.org/browse/FABN-1051) Update pipeline script
* [f19e630](https://github.com/hyperledger/fabric-sdk-node/commit/f19e630) [FABN-1045](https://jira.hyperledger.org/browse/FABN-1045) release notes for v1.4.0
* [55c8f55](https://github.com/hyperledger/fabric-sdk-node/commit/55c8f55) [FABN-1053](https://jira.hyperledger.org/browse/FABN-1053): Rename contract namespace to name
* [afae931](https://github.com/hyperledger/fabric-sdk-node/commit/afae931) [FABN-1052](https://jira.hyperledger.org/browse/FABN-1052) NodeSDK reorder logging test
* [d664de0](https://github.com/hyperledger/fabric-sdk-node/commit/d664de0) [FABN-1051](https://jira.hyperledger.org/browse/FABN-1051) Update pipeline script
* [a688fc2](https://github.com/hyperledger/fabric-sdk-node/commit/a688fc2) [FABN-912](https://jira.hyperledger.org/browse/FABN-912) NodeSDK add connection options
* [003da0d](https://github.com/hyperledger/fabric-sdk-node/commit/003da0d) [FABN-1050](https://jira.hyperledger.org/browse/FABN-1050): Catch errors thrown by event callbacks
* [e60796c](https://github.com/hyperledger/fabric-sdk-node/commit/e60796c) [[FABN-899](https://jira.hyperledger.org/browse/FABN-899)] update toturials for offline private key
* [cfaec8f](https://github.com/hyperledger/fabric-sdk-node/commit/cfaec8f) [FABN-987](https://jira.hyperledger.org/browse/FABN-987): Update JSDoc for ProposalResponseObject
* [0d143be](https://github.com/hyperledger/fabric-sdk-node/commit/0d143be) [FABN-941](https://jira.hyperledger.org/browse/FABN-941) NodeSDK Add peer info to response
* [2f81b2c](https://github.com/hyperledger/fabric-sdk-node/commit/2f81b2c) [[FABN-877] Adjusted doc'ed grpc-max-send-message-](https://jira.hyperledger.org/browse/FABN-877] Adjusted doc'ed grpc-max-send-message-)length
* [790484d](https://github.com/hyperledger/fabric-sdk-node/commit/790484d) [FABN-1048](https://jira.hyperledger.org/browse/FABN-1048) Update pipeline scripts
* [c89e34a](https://github.com/hyperledger/fabric-sdk-node/commit/c89e34a) [FABN-1040](https://jira.hyperledger.org/browse/FABN-1040) add missing fabric client dependencies
* [90201ae](https://github.com/hyperledger/fabric-sdk-node/commit/90201ae) [FABN-1019](https://jira.hyperledger.org/browse/FABN-1019) NodeSDK add orgs to discovery handler
* [462dca2](https://github.com/hyperledger/fabric-sdk-node/commit/462dca2) [FABN-1042](https://jira.hyperledger.org/browse/FABN-1042): Export Wallet in TS definitions
* [765b159](https://github.com/hyperledger/fabric-sdk-node/commit/765b159) Allow discovery to be turned off in fabric-network
* [e3b6d83](https://github.com/hyperledger/fabric-sdk-node/commit/e3b6d83) [[FABN-969](https://jira.hyperledger.org/browse/FABN-969)] Parse environment variables with nconf
* [f79198d](https://github.com/hyperledger/fabric-sdk-node/commit/f79198d) [FABN-1002: fabric-](https://jira.hyperledger.org/browse/FABN-1002: fabric-)network module documentation
* [3c50e3a](https://github.com/hyperledger/fabric-sdk-node/commit/3c50e3a) [[FABN-899](https://jira.hyperledger.org/browse/FABN-899)] update docs for enroll()
* [6eefe64](https://github.com/hyperledger/fabric-sdk-node/commit/6eefe64) [FABN-985](https://jira.hyperledger.org/browse/FABN-985): Use request txId in Channel.queryByChaincode
* [d999468](https://github.com/hyperledger/fabric-sdk-node/commit/d999468) [FABN-1034](https://jira.hyperledger.org/browse/FABN-1034): Prevent hang with concurrent transactions
* [cd0de89](https://github.com/hyperledger/fabric-sdk-node/commit/cd0de89) [[FABN-1033](https://jira.hyperledger.org/browse/FABN-1033)] update jsdoc build scripts
* [680a4ce](https://github.com/hyperledger/fabric-sdk-node/commit/680a4ce) update doc for network setup
* [27b6b1e](https://github.com/hyperledger/fabric-sdk-node/commit/27b6b1e) [[FABN-902](https://jira.hyperledger.org/browse/FABN-902)] update type definition for enroll()
* [cbd442d](https://github.com/hyperledger/fabric-sdk-node/commit/cbd442d) [FABN-1028](https://jira.hyperledger.org/browse/FABN-1028) NodeSDK update ignoring test
* [6d631e4](https://github.com/hyperledger/fabric-sdk-node/commit/6d631e4) [FABN-987](https://jira.hyperledger.org/browse/FABN-987): Update TS defs for ProposalResponseObject
* [54fa5cf](https://github.com/hyperledger/fabric-sdk-node/commit/54fa5cf) [[FABN-897] fabric-ca-](https://jira.hyperledger.org/browse/FABN-897] fabric-ca-)client enroll with csr
* [83fedc9](https://github.com/hyperledger/fabric-sdk-node/commit/83fedc9) [FABN-1026](https://jira.hyperledger.org/browse/FABN-1026): NodeSDK private data tutorial
* [cf3abfd](https://github.com/hyperledger/fabric-sdk-node/commit/cf3abfd) [FABN-1026](https://jira.hyperledger.org/browse/FABN-1026): Add discovery 'asLocalhost' prop to TS defs
* [2068039](https://github.com/hyperledger/fabric-sdk-node/commit/2068039) [FABN-926](https://jira.hyperledger.org/browse/FABN-926): Improve messages for failed proposals
* [db94927](https://github.com/hyperledger/fabric-sdk-node/commit/db94927) [FABN-1001](https://jira.hyperledger.org/browse/FABN-1001): Enable strict typescript compile option
* [c833235](https://github.com/hyperledger/fabric-sdk-node/commit/c833235) [[FABN-1027](https://jira.hyperledger.org/browse/FABN-1027)] README: Fix Markup
* [63fd9ae](https://github.com/hyperledger/fabric-sdk-node/commit/63fd9ae) [FABN-1024](https://jira.hyperledger.org/browse/FABN-1024) Update pipeline scripts
* [9e3cc71](https://github.com/hyperledger/fabric-sdk-node/commit/9e3cc71) [FABN-1024](https://jira.hyperledger.org/browse/FABN-1024) Update pipeline scripts
* [a261444](https://github.com/hyperledger/fabric-sdk-node/commit/a261444) [FABN-1001: Update fabric-](https://jira.hyperledger.org/browse/FABN-1001: Update fabric-)network typescript defs
* [177b286](https://github.com/hyperledger/fabric-sdk-node/commit/177b286) [FABN-1017](https://jira.hyperledger.org/browse/FABN-1017) Update the README.md
* [0ecfdd3](https://github.com/hyperledger/fabric-sdk-node/commit/0ecfdd3) [FABN-972](https://jira.hyperledger.org/browse/FABN-972) NodeSDK Add private data doc
* [7364f18](https://github.com/hyperledger/fabric-sdk-node/commit/7364f18) [[FABN-1020](https://jira.hyperledger.org/browse/FABN-1020)] Correct metadata packaging code for Windows
* [ab11815](https://github.com/hyperledger/fabric-sdk-node/commit/ab11815) [FABN-946](https://jira.hyperledger.org/browse/FABN-946) NodeSDK auto cert not for mutual TLS
* [480fb4c](https://github.com/hyperledger/fabric-sdk-node/commit/480fb4c) [FABN-1014](https://jira.hyperledger.org/browse/FABN-1014): Use ChannelEventHub.connect callback
* [dfdd972](https://github.com/hyperledger/fabric-sdk-node/commit/dfdd972) [[FABN-1010](https://jira.hyperledger.org/browse/FABN-1010)] add missing jsdocs
* [65a8da9](https://github.com/hyperledger/fabric-sdk-node/commit/65a8da9) [FABN-864](https://jira.hyperledger.org/browse/FABN-864) service discovery usage improvements
* [1bc3892](https://github.com/hyperledger/fabric-sdk-node/commit/1bc3892) [FABN-1003](https://jira.hyperledger.org/browse/FABN-1003) NodeSDK add connect callback
* [4348438](https://github.com/hyperledger/fabric-sdk-node/commit/4348438) [FABN-1006](https://jira.hyperledger.org/browse/FABN-1006) Update API docs script
* [f3bff6d](https://github.com/hyperledger/fabric-sdk-node/commit/f3bff6d) [FABN-1002: Tidy-up fabric-](https://jira.hyperledger.org/browse/FABN-1002: Tidy-up fabric-)network JSDoc
* [1bbeea6](https://github.com/hyperledger/fabric-sdk-node/commit/1bbeea6) [FABN-997](https://jira.hyperledger.org/browse/FABN-997) Update pipeline scripts
* [0c12234](https://github.com/hyperledger/fabric-sdk-node/commit/0c12234) [[FABN-1000](https://jira.hyperledger.org/browse/FABN-1000)] Use less strict "is promise" check
* [e20c048](https://github.com/hyperledger/fabric-sdk-node/commit/e20c048) [FABN-929](https://jira.hyperledger.org/browse/FABN-929): Enfore single Transaction invocation
* [93fe94d](https://github.com/hyperledger/fabric-sdk-node/commit/93fe94d) [[FABN-975](https://jira.hyperledger.org/browse/FABN-975)] enable e2e tests
* [c79db9b](https://github.com/hyperledger/fabric-sdk-node/commit/c79db9b) [FABN-997](https://jira.hyperledger.org/browse/FABN-997) Update pipeline scripts
* [d3ada6f](https://github.com/hyperledger/fabric-sdk-node/commit/d3ada6f) [FABN-997](https://jira.hyperledger.org/browse/FABN-997) Update pipeline script
* [b106818](https://github.com/hyperledger/fabric-sdk-node/commit/b106818) [FABN-997](https://jira.hyperledger.org/browse/FABN-997) Update pipeline script
* [adadd93](https://github.com/hyperledger/fabric-sdk-node/commit/adadd93) [FABN-865](https://jira.hyperledger.org/browse/FABN-865): Include event tutorial in docs
* [4a6ef6a](https://github.com/hyperledger/fabric-sdk-node/commit/4a6ef6a) [[FAB-12640](https://jira.hyperledger.org/browse/FAB-12640)] Enable disabled mocha tests
* [1cdd627](https://github.com/hyperledger/fabric-sdk-node/commit/1cdd627) [FABN-997](https://jira.hyperledger.org/browse/FABN-997) Update pipeline script
* [163e5e0](https://github.com/hyperledger/fabric-sdk-node/commit/163e5e0) [FABN-929](https://jira.hyperledger.org/browse/FABN-929): Allow function chaining on Transaction
* [7b2eaff](https://github.com/hyperledger/fabric-sdk-node/commit/7b2eaff) [FABN-990](https://jira.hyperledger.org/browse/FABN-990) NodeSDK return to snapshot publish
* [911c1fa](https://github.com/hyperledger/fabric-sdk-node/commit/911c1fa) [[FABN-975](https://jira.hyperledger.org/browse/FABN-975)] Drive cucumber tests from node_modules dir
* [214b813](https://github.com/hyperledger/fabric-sdk-node/commit/214b813) [FABN-997](https://jira.hyperledger.org/browse/FABN-997) Add credentials in pipeline script
* [edeabd0](https://github.com/hyperledger/fabric-sdk-node/commit/edeabd0) [FABN-995](https://jira.hyperledger.org/browse/FABN-995) NodeSDK update channel event hub doc
* [9668d63](https://github.com/hyperledger/fabric-sdk-node/commit/9668d63) [[FABN-994](https://jira.hyperledger.org/browse/FABN-994)] Typo in Tutorial Document
* [486333f](https://github.com/hyperledger/fabric-sdk-node/commit/486333f) Tidy up network e2e test event listening
* [49637c6](https://github.com/hyperledger/fabric-sdk-node/commit/49637c6) [FAB-12548](https://jira.hyperledger.org/browse/FAB-12548) Update CI Pipeline scripts
* [4dc5ec1](https://github.com/hyperledger/fabric-sdk-node/commit/4dc5ec1) [FABN-993](https://jira.hyperledger.org/browse/FABN-993): Return empty string correctly
* [2ca614d](https://github.com/hyperledger/fabric-sdk-node/commit/2ca614d) [FABN-990](https://jira.hyperledger.org/browse/FABN-990) NodeSDK prepare for 1.4.0 beta
* [2955431](https://github.com/hyperledger/fabric-sdk-node/commit/2955431) [[FAB-12640] Adding stricter ESLint rules to sdk-](https://jira.hyperledger.org/browse/FAB-12640] Adding stricter ESLint rules to sdk-)node
* [421a1bc](https://github.com/hyperledger/fabric-sdk-node/commit/421a1bc) [FABN-929](https://jira.hyperledger.org/browse/FABN-929): Additional JSDoc for transient data
* [a07cc90](https://github.com/hyperledger/fabric-sdk-node/commit/a07cc90) [[FABN-909](https://jira.hyperledger.org/browse/FABN-909)] use devDependancies
* [2f37854](https://github.com/hyperledger/fabric-sdk-node/commit/2f37854) [[FABN-975](https://jira.hyperledger.org/browse/FABN-975)] disable discovery in sceanrio tests
* [9baa401](https://github.com/hyperledger/fabric-sdk-node/commit/9baa401) [[FABN-989](https://jira.hyperledger.org/browse/FABN-989)] Remove redundant packaging code
* [1b14029](https://github.com/hyperledger/fabric-sdk-node/commit/1b14029) [FABN-929](https://jira.hyperledger.org/browse/FABN-929): Transient data with evaluateTransaction()
* [e047f07](https://github.com/hyperledger/fabric-sdk-node/commit/e047f07) [[FABN-988](https://jira.hyperledger.org/browse/FABN-988)] Validate smart contract name/version
* [4f65a2e](https://github.com/hyperledger/fabric-sdk-node/commit/4f65a2e) [FABN-864 Discovery support in fabric-](https://jira.hyperledger.org/browse/FABN-864 Discovery support in fabric-)network api
* [9a37ef1](https://github.com/hyperledger/fabric-sdk-node/commit/9a37ef1) [[FABN-975](https://jira.hyperledger.org/browse/FABN-975)] cucumber test framework
* [967eee1](https://github.com/hyperledger/fabric-sdk-node/commit/967eee1) [FABN-929: Transient data support in fabric-](https://jira.hyperledger.org/browse/FABN-929: Transient data support in fabric-)network
* [61376fe](https://github.com/hyperledger/fabric-sdk-node/commit/61376fe) [[FABN-599](https://jira.hyperledger.org/browse/FABN-599)] Mocha unit tests for Channel
* [4197aed](https://github.com/hyperledger/fabric-sdk-node/commit/4197aed) [[FABN-829](https://jira.hyperledger.org/browse/FABN-829)] Multi version docs fix
* [db4c59f](https://github.com/hyperledger/fabric-sdk-node/commit/db4c59f) [[FABN-829](https://jira.hyperledger.org/browse/FABN-829)] Multi version docs
* [5e99372](https://github.com/hyperledger/fabric-sdk-node/commit/5e99372) [FAB-12617](https://jira.hyperledger.org/browse/FAB-12617) Update pipeline scripts
* [8b59db1](https://github.com/hyperledger/fabric-sdk-node/commit/8b59db1) [FAB-12615 Fix fabric-](https://jira.hyperledger.org/browse/FAB-12615 Fix fabric-)common module name
* [e3fd07b](https://github.com/hyperledger/fabric-sdk-node/commit/e3fd07b) [FABN-981](https://jira.hyperledger.org/browse/FABN-981) Update pipeline scripts
* [74ffdf8](https://github.com/hyperledger/fabric-sdk-node/commit/74ffdf8) [[FAB-12567](https://jira.hyperledger.org/browse/FAB-12567)] executeTransaction to evaluateTransaction
* [458fe61](https://github.com/hyperledger/fabric-sdk-node/commit/458fe61) [[FABN-942](https://jira.hyperledger.org/browse/FABN-942)] Remove gRPC warnings from grpc.load()
* [db0f4cf](https://github.com/hyperledger/fabric-sdk-node/commit/db0f4cf) [FABN-865: Simplify sample plug-](https://jira.hyperledger.org/browse/FABN-865: Simplify sample plug-)in event handler
* [aa7df5e](https://github.com/hyperledger/fabric-sdk-node/commit/aa7df5e) [[FABN-863](https://jira.hyperledger.org/browse/FABN-863)] Added HSM wallet mixin
* [96cfd8f](https://github.com/hyperledger/fabric-sdk-node/commit/96cfd8f) [[FABN-956] logger timeStamp re-](https://jira.hyperledger.org/browse/FABN-956] logger timeStamp re-)order
* [6b46d7d](https://github.com/hyperledger/fabric-sdk-node/commit/6b46d7d) [[FABN-979](https://jira.hyperledger.org/browse/FABN-979)] default logger: enable timeStamp
* [dc849aa](https://github.com/hyperledger/fabric-sdk-node/commit/dc849aa) [FABN-599: More mocha tests for fabric-](https://jira.hyperledger.org/browse/FABN-599: More mocha tests for fabric-)client Channel
* [9b7a616](https://github.com/hyperledger/fabric-sdk-node/commit/9b7a616) [[FABN-976](https://jira.hyperledger.org/browse/FABN-976)] Fix chaincode package install arg validation
* [4f7c9aa](https://github.com/hyperledger/fabric-sdk-node/commit/4f7c9aa) [[FABN-967] type update for fabric-](https://jira.hyperledger.org/browse/FABN-967] type update for fabric-)client
* [e6df05b](https://github.com/hyperledger/fabric-sdk-node/commit/e6df05b) [FABCI-22](https://jira.hyperledger.org/browse/FABCI-22) Pipeline job configuration
* [9f5a2dd](https://github.com/hyperledger/fabric-sdk-node/commit/9f5a2dd) [[FABN-973](https://jira.hyperledger.org/browse/FABN-973)] Improve ChannelEventHub doc for node sdk
* [6b483df](https://github.com/hyperledger/fabric-sdk-node/commit/6b483df) [[FAB-12444] Update fabric-sdk-](https://jira.hyperledger.org/browse/FAB-12444] Update fabric-sdk-)node to baseimage 0.4.14
* [792d86f](https://github.com/hyperledger/fabric-sdk-node/commit/792d86f) [FABN-865: Plug-](https://jira.hyperledger.org/browse/FABN-865: Plug-)in event handlers
* [28f48d3](https://github.com/hyperledger/fabric-sdk-node/commit/28f48d3) [[FABN-862](https://jira.hyperledger.org/browse/FABN-862)] Implemented CouchDB wallet storage
* [4579e7e](https://github.com/hyperledger/fabric-sdk-node/commit/4579e7e) [[FABN-599](https://jira.hyperledger.org/browse/FABN-599) ] enhance gulp mocha tasks
* [7ea726a](https://github.com/hyperledger/fabric-sdk-node/commit/7ea726a) [FABN-962 Update sdk-](https://jira.hyperledger.org/browse/FABN-962 Update sdk-)node to baseimage 0.4.13
* [2840d59](https://github.com/hyperledger/fabric-sdk-node/commit/2840d59) [FABCI-138](https://jira.hyperledger.org/browse/FABCI-138) NodeSDK update version and tag
* [d855f1c](https://github.com/hyperledger/fabric-sdk-node/commit/d855f1c) [[FABN-953](https://jira.hyperledger.org/browse/FABN-953)] reinstate java chaincode tests
* [3243d67](https://github.com/hyperledger/fabric-sdk-node/commit/3243d67) [FABN-951](https://jira.hyperledger.org/browse/FABN-951): Fix event handling concurreny issue
* [d7b354e](https://github.com/hyperledger/fabric-sdk-node/commit/d7b354e) [[FABN-599](https://jira.hyperledger.org/browse/FABN-599)] Fixed eslint issues with autofix
* [a63c19c](https://github.com/hyperledger/fabric-sdk-node/commit/a63c19c) [FABN-955](https://jira.hyperledger.org/browse/FABN-955): Additional logging for tx event handling
* [3d2d893](https://github.com/hyperledger/fabric-sdk-node/commit/3d2d893) [[FABN-599](https://jira.hyperledger.org/browse/FABN-599)] Unit tests for packager module
* [a674009](https://github.com/hyperledger/fabric-sdk-node/commit/a674009) [[FABN-953](https://jira.hyperledger.org/browse/FABN-953)] temporarily disable java chaincode e2e tests
* [526a266](https://github.com/hyperledger/fabric-sdk-node/commit/526a266) [[FABN-909](https://jira.hyperledger.org/browse/FABN-909)] publish empty common module
* [49b73f2](https://github.com/hyperledger/fabric-sdk-node/commit/49b73f2) [[FABN-599](https://jira.hyperledger.org/browse/FABN-599)] Added unit tests
* [70ec069](https://github.com/hyperledger/fabric-sdk-node/commit/70ec069) [[FABN-952](https://jira.hyperledger.org/browse/FABN-952)] update readmes and package information
* [a50f68d](https://github.com/hyperledger/fabric-sdk-node/commit/a50f68d) [[FABN-948] Add top-](https://jira.hyperledger.org/browse/FABN-948] Add top-)level Package class to SDK
* [ab01269](https://github.com/hyperledger/fabric-sdk-node/commit/ab01269) [[FABN-940](https://jira.hyperledger.org/browse/FABN-940)] Contract Namespaces
* [4f19232](https://github.com/hyperledger/fabric-sdk-node/commit/4f19232) [FABN-950](https://jira.hyperledger.org/browse/FABN-950) NodeSDK Update JSDOC for discovery
* [ed043c3](https://github.com/hyperledger/fabric-sdk-node/commit/ed043c3) [FABN-949](https://jira.hyperledger.org/browse/FABN-949) NodeSDK metadataPath not working
* [857c68e](https://github.com/hyperledger/fabric-sdk-node/commit/857c68e) [FABN-599: Mocha unit tests for fabric-](https://jira.hyperledger.org/browse/FABN-599: Mocha unit tests for fabric-)client Channel
* [f356471](https://github.com/hyperledger/fabric-sdk-node/commit/f356471) [[FABN-599](https://jira.hyperledger.org/browse/FABN-599)] Added unit tests
* [6634e1a](https://github.com/hyperledger/fabric-sdk-node/commit/6634e1a) [FABN-944 JSDoc for fabric-](https://jira.hyperledger.org/browse/FABN-944 JSDoc for fabric-)network classes

## 1.4.0-beta
Thu Nov  1 13:30:41 EDT 2018

* [2f37854](https://github.com/hyperledger/fabric-sdk-node/commit/2f37854) [[FABN-975](https://jira.hyperledger.org/browse/FABN-975)] disable discovery in sceanrio tests
* [9baa401](https://github.com/hyperledger/fabric-sdk-node/commit/9baa401) [[FABN-989](https://jira.hyperledger.org/browse/FABN-989)] Remove redundant packaging code
* [1b14029](https://github.com/hyperledger/fabric-sdk-node/commit/1b14029) [FABN-929](https://jira.hyperledger.org/browse/FABN-929): Transient data with evaluateTransaction()
* [e047f07](https://github.com/hyperledger/fabric-sdk-node/commit/e047f07) [[FABN-988](https://jira.hyperledger.org/browse/FABN-988)] Validate smart contract name/version
* [4f65a2e](https://github.com/hyperledger/fabric-sdk-node/commit/4f65a2e) [FABN-864](https://jira.hyperledger.org/browse/FABN-864) Discovery support in fabric-network api
* [9a37ef1](https://github.com/hyperledger/fabric-sdk-node/commit/9a37ef1) [[FABN-975](https://jira.hyperledger.org/browse/FABN-975)] cucumber test framework
* [967eee1](https://github.com/hyperledger/fabric-sdk-node/commit/967eee1) [FABN-929](https://jira.hyperledger.org/browse/FABN-929) Transient data support in fabric-network
* [61376fe](https://github.com/hyperledger/fabric-sdk-node/commit/61376fe) [[FABN-599](https://jira.hyperledger.org/browse/FABN-599)] Mocha unit tests for Channel
* [4197aed](https://github.com/hyperledger/fabric-sdk-node/commit/4197aed) [[FABN-829](https://jira.hyperledger.org/browse/FABN-829)] Multi version docs fix
* [db4c59f](https://github.com/hyperledger/fabric-sdk-node/commit/db4c59f) [[FABN-829](https://jira.hyperledger.org/browse/FABN-829)] Multi version docs
* [5e99372](https://github.com/hyperledger/fabric-sdk-node/commit/5e99372) [FAB-12617](https://jira.hyperledger.org/browse/FAB-12617) Update pipeline scripts
* [8b59db1](https://github.com/hyperledger/fabric-sdk-node/commit/8b59db1) [FAB-12615](https://jira.hyperledger.org/browse/FAB-12615) Fix fabric-common module name
* [e3fd07b](https://github.com/hyperledger/fabric-sdk-node/commit/e3fd07b) [FABN-981](https://jira.hyperledger.org/browse/FABN-981) Update pipeline scripts
* [74ffdf8](https://github.com/hyperledger/fabric-sdk-node/commit/74ffdf8) [[FAB-12567](https://jira.hyperledger.org/browse/FAB-12567)] executeTransaction to evaluateTransaction
* [458fe61](https://github.com/hyperledger/fabric-sdk-node/commit/458fe61) [[FABN-942](https://jira.hyperledger.org/browse/FABN-942)] Remove gRPC warnings from grpc.load()
* [db0f4cf](https://github.com/hyperledger/fabric-sdk-node/commit/db0f4cf) [FABN-865](https://jira.hyperledger.org/browse/FABN-865) Simplify sample plug-in event handler
* [aa7df5e](https://github.com/hyperledger/fabric-sdk-node/commit/aa7df5e) [[FABN-863](https://jira.hyperledger.org/browse/FABN-863)] Added HSM wallet mixin
* [96cfd8f](https://github.com/hyperledger/fabric-sdk-node/commit/96cfd8f) [[FABN-956](https://jira.hyperledger.org/browse/FABN-956) logger timeStamp re-order
* [6b46d7d](https://github.com/hyperledger/fabric-sdk-node/commit/6b46d7d) [[FABN-979](https://jira.hyperledger.org/browse/FABN-979)] default logger: enable timeStamp
* [dc849aa](https://github.com/hyperledger/fabric-sdk-node/commit/dc849aa) [FABN-599](https://jira.hyperledger.org/browse/FABN-599: More mocha tests for fabric-)client Channel
* [9b7a616](https://github.com/hyperledger/fabric-sdk-node/commit/9b7a616) [[FABN-976](https://jira.hyperledger.org/browse/FABN-976)] Fix chaincode package install arg validation
* [4f7c9aa](https://github.com/hyperledger/fabric-sdk-node/commit/4f7c9aa) [[FABN-967](https://jira.hyperledger.org/browse/FABN-967) type update for fabric-client
* [e6df05b](https://github.com/hyperledger/fabric-sdk-node/commit/e6df05b) [FABCI-22](https://jira.hyperledger.org/browse/FABCI-22) Pipeline job configuration
* [9f5a2dd](https://github.com/hyperledger/fabric-sdk-node/commit/9f5a2dd) [[FABN-973](https://jira.hyperledger.org/browse/FABN-973)] Improve ChannelEventHub doc for node sdk
* [6b483df](https://github.com/hyperledger/fabric-sdk-node/commit/6b483df) [[FAB-12444](https://jira.hyperledger.org/browse/FAB-12444) Update fabric-sdk-node to baseimage 0.4.14
* [792d86f](https://github.com/hyperledger/fabric-sdk-node/commit/792d86f) [FABN-865](https://jira.hyperledger.org/browse/FABN-865) Plug-in event handlers
* [28f48d3](https://github.com/hyperledger/fabric-sdk-node/commit/28f48d3) [[FABN-862](https://jira.hyperledger.org/browse/FABN-862)] Implemented CouchDB wallet storage
* [4579e7e](https://github.com/hyperledger/fabric-sdk-node/commit/4579e7e) [[FABN-599](https://jira.hyperledger.org/browse/FABN-599)] enhance gulp mocha tasks

## 1.3.0
Wed Oct 10 10:46:28 EDT 2018

* [f76ae0a](https://github.com/hyperledger/fabric-sdk-node/commit/f76ae0a) NEW VER
* [74f826e](https://github.com/hyperledger/fabric-sdk-node/commit/74f826e) [FABCI-138](https://jira.hyperledger.org/browse/FABCI-138) NodeSDK update tag
* [ec9ef04](https://github.com/hyperledger/fabric-sdk-node/commit/ec9ef04) [FABN-950](https://jira.hyperledger.org/browse/FABN-950) NodeSDK Update JSDOC for discovery
* [a690463](https://github.com/hyperledger/fabric-sdk-node/commit/a690463) [FABN-949](https://jira.hyperledger.org/browse/FABN-949) NodeSDK metadataPath not working
* [60beb0c](https://github.com/hyperledger/fabric-sdk-node/commit/60beb0c) [[FABN-938](https://jira.hyperledger.org/browse/FABN-938) add .gitreview file
* [fbc1b16](https://github.com/hyperledger/fabric-sdk-node/commit/fbc1b16) [[FABN-937](https://jira.hyperledger.org/browse/FABN-937) Test samples: TransientMap value
* [aa55f75](https://github.com/hyperledger/fabric-sdk-node/commit/aa55f75) [[FABN-935](https://jira.hyperledger.org/browse/FABN-935) Fix dependency check in java chaincode test
* [c536a55](https://github.com/hyperledger/fabric-sdk-node/commit/c536a55) [FABN-934](https://jira.hyperledger.org/browse/FABN-934) update getOrganizations jsdoc
* [cb4b568](https://github.com/hyperledger/fabric-sdk-node/commit/cb4b568) [FABN-927](https://jira.hyperledger.org/browse/FABN-927) submitTransaction hanging on multiple txn
* [58d5b81](https://github.com/hyperledger/fabric-sdk-node/commit/58d5b81) [FABN-933](https://jira.hyperledger.org/browse/FABN-933) fix filename typo
* [d703cc2](https://github.com/hyperledger/fabric-sdk-node/commit/d703cc2) [FABN-874](https://jira.hyperledger.org/browse/FABN-874) Part 3, update anchor peers
* [c0fb4a5](https://github.com/hyperledger/fabric-sdk-node/commit/c0fb4a5) [FAB-12117](https://jira.hyperledger.org/browse/FAB-12117) NodeSDK update java chaincode groupid
* [bf70258](https://github.com/hyperledger/fabric-sdk-node/commit/bf70258) [FABN-599](https://jira.hyperledger.org/browse/FABN-599) Unit tests for utils and Client
* [6260a3c](https://github.com/hyperledger/fabric-sdk-node/commit/6260a3c) [FABN-898](https://jira.hyperledger.org/browse/FABN-898) docs for offline signature
* [61cf4b2](https://github.com/hyperledger/fabric-sdk-node/commit/61cf4b2) [FABN-907](https://jira.hyperledger.org/browse/FABN-907) NodeSDK update event doc
* [3f103fe](https://github.com/hyperledger/fabric-sdk-node/commit/3f103fe) [FABN-874](https://jira.hyperledger.org/browse/FABN-874) update anchor peer
* [25f4701](https://github.com/hyperledger/fabric-sdk-node/commit/25f4701) [[FABN-874](https://jira.hyperledger.org/browse/FABN-874)]Private Data disseminate fail
* [f50c9c6](https://github.com/hyperledger/fabric-sdk-node/commit/f50c9c6) [FABN-925](https://jira.hyperledger.org/browse/FABN-925) NodeSDK remove benign error msg
* [3d47ccd](https://github.com/hyperledger/fabric-sdk-node/commit/3d47ccd) [FABN-832](https://jira.hyperledger.org/browse/FABN-832) NodeSDK Add release notes file
* [5c34936](https://github.com/hyperledger/fabric-sdk-node/commit/5c34936) [FABN-844](https://jira.hyperledger.org/browse/FABN-844) NodeSDK local peer discovery
* [119aaa7](https://github.com/hyperledger/fabric-sdk-node/commit/119aaa7) [FABN-924](https://jira.hyperledger.org/browse/FABN-924) update baseimage to 0.4.12
* [945348f](https://github.com/hyperledger/fabric-sdk-node/commit/945348f) [FABN-923](https://jira.hyperledger.org/browse/FABN-923) remove async for generateUnsignedTransaction
* [3de24eb](https://github.com/hyperledger/fabric-sdk-node/commit/3de24eb) [FABN-921](https://jira.hyperledger.org/browse/FABN-921) NodeSDK add service discovery doc
* [e7f85e1](https://github.com/hyperledger/fabric-sdk-node/commit/e7f85e1) [FABN-883](https://jira.hyperledger.org/browse/FABN-883) NodeSDK Common Connection Profile
* [300e0e9](https://github.com/hyperledger/fabric-sdk-node/commit/300e0e9) [FABN-922](https://jira.hyperledger.org/browse/FABN-922) uncouple fabric-network
* [3e09b99](https://github.com/hyperledger/fabric-sdk-node/commit/3e09b99) [[FABN-599](https://jira.hyperledger.org/browse/FABN-599) Unit tests for hash
* [dac25b4](https://github.com/hyperledger/fabric-sdk-node/commit/dac25b4) [FABN-917](https://jira.hyperledger.org/browse/FABN-917) Add unresponded event hubs to timeout message
* [97cbb10](https://github.com/hyperledger/fabric-sdk-node/commit/97cbb10) [FABN-920](https://jira.hyperledger.org/browse/FABN-920) TS defs for Gateway connect/disconnect
* [9500a4d](https://github.com/hyperledger/fabric-sdk-node/commit/9500a4d) [FABN-599](https://jira.hyperledger.org/browse/FABN-599) Unit tests for Api
* [438ea47](https://github.com/hyperledger/fabric-sdk-node/commit/438ea47) [FABN-599](https://jira.hyperledger.org/browse/FABN-599) Unit tests for Remote
* [8d6e09f](https://github.com/hyperledger/fabric-sdk-node/commit/8d6e09f) [FABN-919](https://jira.hyperledger.org/browse/FABN-919) Add error messages to event strategy failures
* [0f97da3](https://github.com/hyperledger/fabric-sdk-node/commit/0f97da3) [FABN-844](https://jira.hyperledger.org/browse/FABN-844) NodeSDK timeout on queryByChaincode
* [6366fac](https://github.com/hyperledger/fabric-sdk-node/commit/6366fac) [FABN-916](https://jira.hyperledger.org/browse/FABN-916) NodeSDK Update GRPC level
* [694871f](https://github.com/hyperledger/fabric-sdk-node/commit/694871f) [FABN-599](https://jira.hyperledger.org/browse/FABN-599) Unit tests for client-utils
* [eee0b27](https://github.com/hyperledger/fabric-sdk-node/commit/eee0b27) [[FABN-599](https://jira.hyperledger.org/browse/FABN-599) Unit tests for Constants
* [2855a85](https://github.com/hyperledger/fabric-sdk-node/commit/2855a85) [[FABN-599](https://jira.hyperledger.org/browse/FABN-599) Unit tests for Config
* [91c1f17](https://github.com/hyperledger/fabric-sdk-node/commit/91c1f17) [[FABN-908](https://jira.hyperledger.org/browse/FABN-908) using channel eventhub offline
* [84d0718](https://github.com/hyperledger/fabric-sdk-node/commit/84d0718) [FABN-900](https://jira.hyperledger.org/browse/FABN-900) NodeSDK Connect error return URL
* [8a56714](https://github.com/hyperledger/fabric-sdk-node/commit/8a56714) [FABN-599](https://jira.hyperledger.org/browse/FABN-599) Unit test for BlockDecoder
* [828c718](https://github.com/hyperledger/fabric-sdk-node/commit/828c718) [FABN-910](https://jira.hyperledger.org/browse/FABN-910) Connect EventHubs up front in network api
* [8796095](https://github.com/hyperledger/fabric-sdk-node/commit/8796095) [FABN-887](https://jira.hyperledger.org/browse/FABN-887) deploy Java chaincode
* [19b6086](https://github.com/hyperledger/fabric-sdk-node/commit/19b6086) [FABN-843](https://jira.hyperledger.org/browse/FABN-843) Discovery using collections
* [399bd25](https://github.com/hyperledger/fabric-sdk-node/commit/399bd25) [FABN-858](https://jira.hyperledger.org/browse/FABN-858) improve tests
* [8d5ab8a](https://github.com/hyperledger/fabric-sdk-node/commit/8d5ab8a) [FABN-906](https://jira.hyperledger.org/browse/FABN-906) Update thirdparty image version
* [6de77fe](https://github.com/hyperledger/fabric-sdk-node/commit/6de77fe) [FABN-905](https://jira.hyperledger.org/browse/FABN-905) Add typescript support for event
* [b13a8e9](https://github.com/hyperledger/fabric-sdk-node/commit/b13a8e9) [[FAB-11059](https://jira.hyperledger.org/browse/FAB-11059) unit test for base client
* [ba2508f](https://github.com/hyperledger/fabric-sdk-node/commit/ba2508f) [FABN-903](https://jira.hyperledger.org/browse/FABN-903) Rename fabric-network classes
* [7441939](https://github.com/hyperledger/fabric-sdk-node/commit/7441939) [FABN-842](https://jira.hyperledger.org/browse/FABN-842) discovery cc2cc
* [5ce3363](https://github.com/hyperledger/fabric-sdk-node/commit/5ce3363) [FABN-857](https://jira.hyperledger.org/browse/FABN-857)
* [117a00f](https://github.com/hyperledger/fabric-sdk-node/commit/117a00f) Fix issue installing chaincode package
* [7b05d75](https://github.com/hyperledger/fabric-sdk-node/commit/7b05d75) [FABN-896](https://jira.hyperledger.org/browse/FABN-896) sign transaction offline
* [ec0dc97](https://github.com/hyperledger/fabric-sdk-node/commit/ec0dc97) [FABN-861](https://jira.hyperledger.org/browse/FABN-861) fabric-network typescript definitions
* [eb56c95](https://github.com/hyperledger/fabric-sdk-node/commit/eb56c95) [FABN-866](https://jira.hyperledger.org/browse/FABN-866) provide executeTransaction capability
* [f48cb3c](https://github.com/hyperledger/fabric-sdk-node/commit/f48cb3c) [FAB-11059](https://jira.hyperledger.org/browse/FAB-11059) unit test for packager
* [3c0f31a](https://github.com/hyperledger/fabric-sdk-node/commit/3c0f31a) [FAB-11059](https://jira.hyperledger.org/browse/FAB-11059) unit tests for sideDB
* [54cb147](https://github.com/hyperledger/fabric-sdk-node/commit/54cb147) [FABN-891](https://jira.hyperledger.org/browse/FABN-891) Make documentation and types consistent
* [59afcfd](https://github.com/hyperledger/fabric-sdk-node/commit/59afcfd) [FAB-11059](https://jira.hyperledger.org/browse/FAB-11059) unit tests for ca
* [bb06fbc](https://github.com/hyperledger/fabric-sdk-node/commit/bb06fbc) [FAB-11059](https://jira.hyperledger.org/browse/FAB-11059) unit test for peer
* [b31eae5](https://github.com/hyperledger/fabric-sdk-node/commit/b31eae5) [FAB-11059](https://jira.hyperledger.org/browse/FAB-11059) unit tests for organization
* [5ef917f](https://github.com/hyperledger/fabric-sdk-node/commit/5ef917f) [FABN-856](https://jira.hyperledger.org/browse/FABN-856) submitTransaction API
* [ab85e84](https://github.com/hyperledger/fabric-sdk-node/commit/ab85e84) [FABN-886](https://jira.hyperledger.org/browse/FABN-886)Fix gulp docker-clean for network-e2enodecc
* [39ceca3](https://github.com/hyperledger/fabric-sdk-node/commit/39ceca3) [FAB-11059](https://jira.hyperledger.org/browse/FAB-11059) orderer unit tests
* [cb591c5](https://github.com/hyperledger/fabric-sdk-node/commit/cb591c5) [FABN-859](https://jira.hyperledger.org/browse/FABN-859) Add support for File System Wallet
* [b2416b3](https://github.com/hyperledger/fabric-sdk-node/commit/b2416b3) [FABN-882](https://jira.hyperledger.org/browse/FABN-882) update script to publish fabric-network
* [f70b744](https://github.com/hyperledger/fabric-sdk-node/commit/f70b744) [FABN-878](https://jira.hyperledger.org/browse/FABN-878) query for collection configuration
* [ddcebe8](https://github.com/hyperledger/fabric-sdk-node/commit/ddcebe8) [FAB-11059](https://jira.hyperledger.org/browse/FAB-11059) add unit test for policy
* [6c385e7](https://github.com/hyperledger/fabric-sdk-node/commit/6c385e7) [FABN-882](https://jira.hyperledger.org/browse/FABN-882) update script to publish fabric-network
* [196c9e4](https://github.com/hyperledger/fabric-sdk-node/commit/196c9e4) [FABN-856](https://jira.hyperledger.org/browse/FABN-856) submitTxn API test and gitignore update
* [781ef3f](https://github.com/hyperledger/fabric-sdk-node/commit/781ef3f) [FABN-880](https://jira.hyperledger.org/browse/FABN-880) Remove mspManagers state storage in utils.js
* [c680a30](https://github.com/hyperledger/fabric-sdk-node/commit/c680a30) [FABN-856](https://jira.hyperledger.org/browse/FABN-856) submitTransaction API
* [74d8a1d](https://github.com/hyperledger/fabric-sdk-node/commit/74d8a1d) [FABN-876](https://jira.hyperledger.org/browse/FABN-876) Decode metadata writes in BlockDecoder
* [a0a7fb0](https://github.com/hyperledger/fabric-sdk-node/commit/a0a7fb0) [FABN-830](https://jira.hyperledger.org/browse/FABN-830) Client calls toBytes of PKCS11 keys
* [4c0b4f9](https://github.com/hyperledger/fabric-sdk-node/commit/4c0b4f9) [FABN-839](https://jira.hyperledger.org/browse/FABN-839) update jsdoc
* [c8ba5bd](https://github.com/hyperledger/fabric-sdk-node/commit/c8ba5bd) [FABN-873](https://jira.hyperledger.org/browse/FABN-873) Decode hashed rwset in BlockDecoder
* [491b6b0](https://github.com/hyperledger/fabric-sdk-node/commit/491b6b0) [FABN-872](https://jira.hyperledger.org/browse/FABN-872) Remove references to v1.0 from node.js docs
* [d5e5582](https://github.com/hyperledger/fabric-sdk-node/commit/d5e5582) [FABN-853](https://jira.hyperledger.org/browse/FABN-853) listen for newest block
* [f064daa](https://github.com/hyperledger/fabric-sdk-node/commit/f064daa) [FABN-868](https://jira.hyperledger.org/browse/FABN-868) Update fabric-client type definition
* [3b187e4](https://github.com/hyperledger/fabric-sdk-node/commit/3b187e4) [[FABN-838](https://jira.hyperledger.org/browse/FABN-838) update BlockDecoder.timeStampToDate()
* [b7b44c2](https://github.com/hyperledger/fabric-sdk-node/commit/b7b44c2) [FABN-871](https://jira.hyperledger.org/browse/FABN-871) make build process more flexible
* [76b5ded](https://github.com/hyperledger/fabric-sdk-node/commit/76b5ded) [[FABN-870](https://jira.hyperledger.org/browse/FABN-870) update jsdoc for service discovery
* [5284de5](https://github.com/hyperledger/fabric-sdk-node/commit/5284de5) [[FABN-869](https://jira.hyperledger.org/browse/FABN-869) Fix TypeScript test script
* [79b464c](https://github.com/hyperledger/fabric-sdk-node/commit/79b464c) [FABN-852](https://jira.hyperledger.org/browse/FABN-852) monitor all transactions
* [531269e](https://github.com/hyperledger/fabric-sdk-node/commit/531269e) [FABN-851](https://jira.hyperledger.org/browse/FABN-851) Improve orderer error msg
* [040e42f](https://github.com/hyperledger/fabric-sdk-node/commit/040e42f) [FAB-11259](https://jira.hyperledger.org/browse/FAB-11259) Pipeline job configuration
* [5e077cd](https://github.com/hyperledger/fabric-sdk-node/commit/5e077cd) [FABN-850](https://jira.hyperledger.org/browse/FABN-850) Added inclusion of .s files on compilation
* [2561c8a](https://github.com/hyperledger/fabric-sdk-node/commit/2561c8a) [[FABN-847](https://jira.hyperledger.org/browse/FABN-847) Refactor channel.sendTransaction
* [1e00aca](https://github.com/hyperledger/fabric-sdk-node/commit/1e00aca) [FABN-849](https://jira.hyperledger.org/browse/FABN-849) update protos
* [43afb5a](https://github.com/hyperledger/fabric-sdk-node/commit/43afb5a) [[FABN-845](https://jira.hyperledger.org/browse/FABN-845) JSDoc update for SideDB.js
* [b130e3c](https://github.com/hyperledger/fabric-sdk-node/commit/b130e3c) [[FABN-681](https://jira.hyperledger.org/browse/FABN-681) ESlint fix for utils.js
* [38ff937](https://github.com/hyperledger/fabric-sdk-node/commit/38ff937) [[FAB-11124](https://jira.hyperledger.org/browse/FAB-11124) remove config property about EventHub
* [a38bbda](https://github.com/hyperledger/fabric-sdk-node/commit/a38bbda) [[FAB-11059](https://jira.hyperledger.org/browse/FAB-11059) Add fabric-client mocha tests
* [b7e528d](https://github.com/hyperledger/fabric-sdk-node/commit/b7e528d) [[FAB-11059](https://jira.hyperledger.org/browse/FAB-11059) complete ca-client mocha tests
* [0e9536d](https://github.com/hyperledger/fabric-sdk-node/commit/0e9536d) [FABN-837](https://jira.hyperledger.org/browse/FABN-837) jsdoc fix on ChannelEventHub
* [20cd5dd](https://github.com/hyperledger/fabric-sdk-node/commit/20cd5dd) [FABN-830](https://jira.hyperledger.org/browse/FABN-830) addTlsClientCertAndKey wrong cryptosuite
* [e16ae90](https://github.com/hyperledger/fabric-sdk-node/commit/e16ae90) [[FAB-8232](https://jira.hyperledger.org/browse/FAB-8232) apply ES6 syntax to Channel,ChannelEventHub
* [25fa4b0](https://github.com/hyperledger/fabric-sdk-node/commit/25fa4b0) [FABN-826](https://jira.hyperledger.org/browse/FABN-826) restore backward compatibility for errors
* [cfaf748](https://github.com/hyperledger/fabric-sdk-node/commit/cfaf748) [FAB-11231](https://jira.hyperledger.org/browse/FAB-11231) node sdk to handle chaincode errors
* [26f5b19](https://github.com/hyperledger/fabric-sdk-node/commit/26f5b19) [[FAB-11142](https://jira.hyperledger.org/browse/FAB-11142) update client.createUser
* [1cd9109](https://github.com/hyperledger/fabric-sdk-node/commit/1cd9109) [FAB-11122](https://jira.hyperledger.org/browse/FAB-11122) NodeSDK remove EventHub
* [30ad986](https://github.com/hyperledger/fabric-sdk-node/commit/30ad986) [[FAB-11059](https://jira.hyperledger.org/browse/FAB-11059) establish mocha tests
* [d7b5d00](https://github.com/hyperledger/fabric-sdk-node/commit/d7b5d00) [[FAB-11190](https://jira.hyperledger.org/browse/FAB-11190) remove v1.1 experimental channel configs
* [186ace3](https://github.com/hyperledger/fabric-sdk-node/commit/186ace3) [FAB-11179](https://jira.hyperledger.org/browse/FAB-11179) Handle missing discovery
* [d23963e](https://github.com/hyperledger/fabric-sdk-node/commit/d23963e) [[FAB-8232](https://jira.hyperledger.org/browse/FAB-8232) Simply Client.js and unit test
* [eab89ac](https://github.com/hyperledger/fabric-sdk-node/commit/eab89ac) [FAB-8973](https://jira.hyperledger.org/browse/FAB-8973) Badge link fix on master branch
* [d352441](https://github.com/hyperledger/fabric-sdk-node/commit/d352441) [FAB-10809](https://jira.hyperledger.org/browse/FAB-10809) remove lint errors

## v1.2.0
Fri Jul  6 08:14:31 EDT 2018

* [0087554](https://github.com/hyperledger/fabric-sdk-node/commit/0087554) Prepare for release v1.2.0
* [65675e4](https://github.com/hyperledger/fabric-sdk-node/commit/65675e4) [[FAB-10958](https://jira.hyperledger.org/browse/FAB-10958)]Fix typos and broken links
* [b0b4c49](https://github.com/hyperledger/fabric-sdk-node/commit/b0b4c49) [FAB-10917](https://jira.hyperledger.org/browse/FAB-10917) NodeSDK - return channel methods
* [acf0e04](https://github.com/hyperledger/fabric-sdk-node/commit/acf0e04) [FAB-10940](https://jira.hyperledger.org/browse/FAB-10940) installChaincode doesn’t restrict to org
* [6607f7f](https://github.com/hyperledger/fabric-sdk-node/commit/6607f7f) [FAB-10916](https://jira.hyperledger.org/browse/FAB-10916) NodeSDK - allow create peers without TLS
* [8bb7f22](https://github.com/hyperledger/fabric-sdk-node/commit/8bb7f22) [[FAB-10919](https://jira.hyperledger.org/browse/FAB-10919)]Fix the version of Node.js in tutorial
* [9f32dbd](https://github.com/hyperledger/fabric-sdk-node/commit/9f32dbd) [FAB-10910](https://jira.hyperledger.org/browse/FAB-10910) default channel not returned
* [4293680](https://github.com/hyperledger/fabric-sdk-node/commit/4293680) [FAB-10856](https://jira.hyperledger.org/browse/FAB-10856)  NodeSDK getByOrg not working
* [20da621](https://github.com/hyperledger/fabric-sdk-node/commit/20da621) [FAB-10902](https://jira.hyperledger.org/browse/FAB-10902) NodeSDK - remove anchor links to sections
* [3948c22](https://github.com/hyperledger/fabric-sdk-node/commit/3948c22) update maintainers
* [cce2a38](https://github.com/hyperledger/fabric-sdk-node/commit/cce2a38) [FAB-10808](https://jira.hyperledger.org/browse/FAB-10808) NodeSDK - add private-data.js to e2e.js
* [23ec52f](https://github.com/hyperledger/fabric-sdk-node/commit/23ec52f) [[FAB-10682](https://jira.hyperledger.org/browse/FAB-10682)] Use self-signed TLS certs
* [ac81154](https://github.com/hyperledger/fabric-sdk-node/commit/ac81154) [FAB-10808](https://jira.hyperledger.org/browse/FAB-10808) NodeSDK - add e2e tests for private data
* [a4ec564](https://github.com/hyperledger/fabric-sdk-node/commit/a4ec564) [FAB-10793](https://jira.hyperledger.org/browse/FAB-10793) NodeSDK Update Mutual TLS doc
* [71d4ef4](https://github.com/hyperledger/fabric-sdk-node/commit/71d4ef4) [FAB-10745](https://jira.hyperledger.org/browse/FAB-10745) NodeSDK Handle missing ledger_height
* [e146ad5](https://github.com/hyperledger/fabric-sdk-node/commit/e146ad5) [[FAB-10740](https://jira.hyperledger.org/browse/FAB-10740)] remove executeTransaction
* [29fbf11](https://github.com/hyperledger/fabric-sdk-node/commit/29fbf11) [[FAB-10681](https://jira.hyperledger.org/browse/FAB-10681)] Generate self-signed X509 cert
* [9375d2b](https://github.com/hyperledger/fabric-sdk-node/commit/9375d2b) [[FAB-8232](https://jira.hyperledger.org/browse/FAB-8232)] simplify promise chain with async/await
* [24d43c4](https://github.com/hyperledger/fabric-sdk-node/commit/24d43c4) [FAB-10672](https://jira.hyperledger.org/browse/FAB-10672) NodeSDK - service discovery tutorial
* [b351453](https://github.com/hyperledger/fabric-sdk-node/commit/b351453) [FAB-10717](https://jira.hyperledger.org/browse/FAB-10717) NodeSDK - SD endorsements fail
* [4f80b2d](https://github.com/hyperledger/fabric-sdk-node/commit/4f80b2d) [FAB-10721](https://jira.hyperledger.org/browse/FAB-10721) NodeSDK - Fix broken link
* [127de22](https://github.com/hyperledger/fabric-sdk-node/commit/127de22) [FAB-10684](https://jira.hyperledger.org/browse/FAB-10684) NodeSDK - update private data tutorial
* [dd33c49](https://github.com/hyperledger/fabric-sdk-node/commit/dd33c49) [[FAB-8232](https://jira.hyperledger.org/browse/FAB-8232)] simplify promise chain with async/await
* [0617b9a](https://github.com/hyperledger/fabric-sdk-node/commit/0617b9a) [FAB-10684](https://jira.hyperledger.org/browse/FAB-10684) NodeSDK - add private data tutorial
* [0891df6](https://github.com/hyperledger/fabric-sdk-node/commit/0891df6) [[FAB-10656](https://jira.hyperledger.org/browse/FAB-10656)] Add option to skip decoding blocks/txs
* [e48c3b7](https://github.com/hyperledger/fabric-sdk-node/commit/e48c3b7) [FAB-10627](https://jira.hyperledger.org/browse/FAB-10627) NodeSDK - use multiple orderers
* [f1340c8](https://github.com/hyperledger/fabric-sdk-node/commit/f1340c8) [[FAB-10636](https://jira.hyperledger.org/browse/FAB-10636)] update fabric-client type definitions
* [5dc8931](https://github.com/hyperledger/fabric-sdk-node/commit/5dc8931) [FAB-10298](https://jira.hyperledger.org/browse/FAB-10298) NodeSDK Client to return proper CA
* [b6e6109](https://github.com/hyperledger/fabric-sdk-node/commit/b6e6109) [FAB-10602](https://jira.hyperledger.org/browse/FAB-10602) NodeSDK - tutorial on logging
* [95fbcec](https://github.com/hyperledger/fabric-sdk-node/commit/95fbcec) [FAB-10497](https://jira.hyperledger.org/browse/FAB-10497) - NodeSDK - sidedb fix
* [7438a71](https://github.com/hyperledger/fabric-sdk-node/commit/7438a71) [FAB-8806](https://jira.hyperledger.org/browse/FAB-8806) NodeSDK - Discovery part 3
* [c0913d2](https://github.com/hyperledger/fabric-sdk-node/commit/c0913d2) [FAB-8806](https://jira.hyperledger.org/browse/FAB-8806) NodeSDK - Discovery part 2
* [bd559eb](https://github.com/hyperledger/fabric-sdk-node/commit/bd559eb) [[FAB-10522](https://jira.hyperledger.org/browse/FAB-10522)] Fix repository url
* [acce409](https://github.com/hyperledger/fabric-sdk-node/commit/acce409) [FAB-10497](https://jira.hyperledger.org/browse/FAB-10497) NodeSDK blockToLive error
* [8e217df](https://github.com/hyperledger/fabric-sdk-node/commit/8e217df) [[FAB-10429](https://jira.hyperledger.org/browse/FAB-10429)] split eslint config from gulp task
* [123302e](https://github.com/hyperledger/fabric-sdk-node/commit/123302e) [FAB-8806](https://jira.hyperledger.org/browse/FAB-8806) NodeSDK - update protos
* [b4231dd](https://github.com/hyperledger/fabric-sdk-node/commit/b4231dd) [FAB-10045](https://jira.hyperledger.org/browse/FAB-10045) NodeSDK do not read db on user load
* [3a9087f](https://github.com/hyperledger/fabric-sdk-node/commit/3a9087f) [[FAB-9402](https://jira.hyperledger.org/browse/FAB-9402)] key.js extends api.js explicitly
* [4cdffce](https://github.com/hyperledger/fabric-sdk-node/commit/4cdffce) [[FAB-9020](https://jira.hyperledger.org/browse/FAB-9020)] Simplify Remote.js
* [fb75164](https://github.com/hyperledger/fabric-sdk-node/commit/fb75164) [[FAB-9374](https://jira.hyperledger.org/browse/FAB-9374)] Add support for Certificates API on Node SDK
* [a851829](https://github.com/hyperledger/fabric-sdk-node/commit/a851829) [FAB-10434](https://jira.hyperledger.org/browse/FAB-10434) NodeSDK - use nyc for code coverage
* [daaf7b7](https://github.com/hyperledger/fabric-sdk-node/commit/daaf7b7) [[FAB-10397](https://jira.hyperledger.org/browse/FAB-10397)] Add blockToLive to collection config
* [8127cac](https://github.com/hyperledger/fabric-sdk-node/commit/8127cac) [[FAB-10402](https://jira.hyperledger.org/browse/FAB-10402)] BlockDecoder decodes chaincode input
* [e9f8201](https://github.com/hyperledger/fabric-sdk-node/commit/e9f8201) [FAB-9928](https://jira.hyperledger.org/browse/FAB-9928) NodeSDK - Add caName option to setUserContext
* [a23064a](https://github.com/hyperledger/fabric-sdk-node/commit/a23064a) [FAB-10350](https://jira.hyperledger.org/browse/FAB-10350) NodeSDK - update fabric-ca-services-tests
* [679921e](https://github.com/hyperledger/fabric-sdk-node/commit/679921e) [FAB-10257](https://jira.hyperledger.org/browse/FAB-10257) NodeSDK - update packages
* [f6a96d2](https://github.com/hyperledger/fabric-sdk-node/commit/f6a96d2) [[FAB-10233](https://jira.hyperledger.org/browse/FAB-10233)]Reduce duplicate creating big number
* [ea00937](https://github.com/hyperledger/fabric-sdk-node/commit/ea00937) Revert "[[FAB-10241](https://jira.hyperledger.org/browse/FAB-10241)]"
* [c0bd09c](https://github.com/hyperledger/fabric-sdk-node/commit/c0bd09c) [FAB-8806](https://jira.hyperledger.org/browse/FAB-8806) NodeSDK - discovery part 1
* [19d3ddd](https://github.com/hyperledger/fabric-sdk-node/commit/19d3ddd) [[FAB-10241](https://jira.hyperledger.org/browse/FAB-10241)] update fabric-sdk-node by fabric-ca changes
* [61b5493](https://github.com/hyperledger/fabric-sdk-node/commit/61b5493) [[FAB-9679](https://jira.hyperledger.org/browse/FAB-9679)] Private Data Support
* [ca90c97](https://github.com/hyperledger/fabric-sdk-node/commit/ca90c97) [[FAB-8791](https://jira.hyperledger.org/browse/FAB-8791)] Optimize hash primitive and CryptoSuite impl
* [e55f817](https://github.com/hyperledger/fabric-sdk-node/commit/e55f817) [[FAB-9963](https://jira.hyperledger.org/browse/FAB-9963)] Fix some test which received an error
* [c4eebe9](https://github.com/hyperledger/fabric-sdk-node/commit/c4eebe9) [[FAB-7670](https://jira.hyperledger.org/browse/FAB-7670)] introduce new API executeTransaction()
* [2c127cb](https://github.com/hyperledger/fabric-sdk-node/commit/2c127cb) [FAB-9769](https://jira.hyperledger.org/browse/FAB-9769) NodeSDK - update protos
* [7401007](https://github.com/hyperledger/fabric-sdk-node/commit/7401007) [FAB-8830](https://jira.hyperledger.org/browse/FAB-8830) NodeSDK Prepare for service discovery
* [211c4a8](https://github.com/hyperledger/fabric-sdk-node/commit/211c4a8) [[FAB-9529](https://jira.hyperledger.org/browse/FAB-9529)] add check for grpc connection establish
* [2d81c17](https://github.com/hyperledger/fabric-sdk-node/commit/2d81c17) [[FAB-9335](https://jira.hyperledger.org/browse/FAB-9335)] add timeout for fabric-ca-client request
* [9bc92d1](https://github.com/hyperledger/fabric-sdk-node/commit/9bc92d1) [[FAB-9500](https://jira.hyperledger.org/browse/FAB-9500)] Add missing setCryptoKeyStore function
* [82cfb26](https://github.com/hyperledger/fabric-sdk-node/commit/82cfb26) [FAB-9493](https://jira.hyperledger.org/browse/FAB-9493) NodeSDK - add test for multiple CCevent
* [d80de86](https://github.com/hyperledger/fabric-sdk-node/commit/d80de86) [FAB-9337](https://jira.hyperledger.org/browse/FAB-9337) NodeSDK - use legacy grpc max settings
* [624f69c](https://github.com/hyperledger/fabric-sdk-node/commit/624f69c) [[FAB-9364](https://jira.hyperledger.org/browse/FAB-9364)] fix Typescript compiling error
* [d85d349](https://github.com/hyperledger/fabric-sdk-node/commit/d85d349) [FAB-3676](https://jira.hyperledger.org/browse/FAB-3676) add check_license
* [5aeda42](https://github.com/hyperledger/fabric-sdk-node/commit/5aeda42) [FAB-9353](https://jira.hyperledger.org/browse/FAB-9353) add CODE_OF_CONDUCT.md
* [104f099](https://github.com/hyperledger/fabric-sdk-node/commit/104f099) [[FAB-8687](https://jira.hyperledger.org/browse/FAB-8687)] Channel name Regex verify
* [1cc0c83](https://github.com/hyperledger/fabric-sdk-node/commit/1cc0c83) [[FAB-9284](https://jira.hyperledger.org/browse/FAB-9284)] Fix loss of custom even
* [4815f5e](https://github.com/hyperledger/fabric-sdk-node/commit/4815f5e) [FAB-8749](https://jira.hyperledger.org/browse/FAB-8749) NodeSDK - all EventHub to use admin
* [1223f39](https://github.com/hyperledger/fabric-sdk-node/commit/1223f39) [[FAB-9175](https://jira.hyperledger.org/browse/FAB-9175)] update fabric-ca-client IdentityService
* [a2efd26](https://github.com/hyperledger/fabric-sdk-node/commit/a2efd26) [[FAB-7539](https://jira.hyperledger.org/browse/FAB-7539)] Cleanup channel event doc
* [2de44f4](https://github.com/hyperledger/fabric-sdk-node/commit/2de44f4) [FAB-5755](https://jira.hyperledger.org/browse/FAB-5755) NodeSDK - update doc on transID
* [763dc5d](https://github.com/hyperledger/fabric-sdk-node/commit/763dc5d) [[FAB-9072](https://jira.hyperledger.org/browse/FAB-9072)] unconditionally ignore node_modules folder
* [54488fe](https://github.com/hyperledger/fabric-sdk-node/commit/54488fe) [FAB-8751](https://jira.hyperledger.org/browse/FAB-8751) NodeSDK - e2e use channel event hub
* [93df558](https://github.com/hyperledger/fabric-sdk-node/commit/93df558) [FAB-9063](https://jira.hyperledger.org/browse/FAB-9063) Provide link to Fabric committers
* [65d12c5](https://github.com/hyperledger/fabric-sdk-node/commit/65d12c5) [FAB-5622](https://jira.hyperledger.org/browse/FAB-5622) NodeSDK - improve test error msg
* [0bc73ac](https://github.com/hyperledger/fabric-sdk-node/commit/0bc73ac) [FAB-8749](https://jira.hyperledger.org/browse/FAB-8749) NodeSDK - allow admin identity
* [66d5e96](https://github.com/hyperledger/fabric-sdk-node/commit/66d5e96) [FAB-8326](https://jira.hyperledger.org/browse/FAB-8326) NodeSDK - fix golang lint issues
* [ab2c8e8](https://github.com/hyperledger/fabric-sdk-node/commit/ab2c8e8) [FAB-8969](https://jira.hyperledger.org/browse/FAB-8969) NodeSDK - '/0' fix missing on mutual tls
* [e3f9043](https://github.com/hyperledger/fabric-sdk-node/commit/e3f9043) [[FAB-8942](https://jira.hyperledger.org/browse/FAB-8942)] fix type definition for 1.1 release
* [2a5f8cb](https://github.com/hyperledger/fabric-sdk-node/commit/2a5f8cb) [[FAB-8973](https://jira.hyperledger.org/browse/FAB-8973)]Remove node 6 badge
* [c12930b](https://github.com/hyperledger/fabric-sdk-node/commit/c12930b) [[FAB-8953](https://jira.hyperledger.org/browse/FAB-8953)] Fix eslint error
* [bd59ae5](https://github.com/hyperledger/fabric-sdk-node/commit/bd59ae5) [FAB-8952](https://jira.hyperledger.org/browse/FAB-8952) Rename maintainers file
* [907e33e](https://github.com/hyperledger/fabric-sdk-node/commit/907e33e) [[FAB-8791](https://jira.hyperledger.org/browse/FAB-8791)] refactor:using ES6 class in hash.js
* [c1c04b7](https://github.com/hyperledger/fabric-sdk-node/commit/c1c04b7) [FAB-8893](https://jira.hyperledger.org/browse/FAB-8893) NodeSDK - prepare for v1.2.0
* [a8abc65](https://github.com/hyperledger/fabric-sdk-node/commit/a8abc65) [[FAB-8515](https://jira.hyperledger.org/browse/FAB-8515)] eslint fix in /lib/impl/

## v1.1.0
Thu Mar 15 17:05:00 EDT 2018

* [b98458d](https://github.com/hyperledger/fabric-sdk-node/commit/b98458d) [[FAB-8878](https://jira.hyperledger.org/browse/FAB-8878)] update type definitions for fabric-client
* [e66465c](https://github.com/hyperledger/fabric-sdk-node/commit/e66465c) [[FAB-8879](https://jira.hyperledger.org/browse/FAB-8879)] add type definition for fabric-ca-client
* [9e34bfb](https://github.com/hyperledger/fabric-sdk-node/commit/9e34bfb) [[FAB-8876](https://jira.hyperledger.org/browse/FAB-8876)] Update test network.yaml
* [9ad4356](https://github.com/hyperledger/fabric-sdk-node/commit/9ad4356) [FAB-8826](https://jira.hyperledger.org/browse/FAB-8826) NodeSDK Update cloudant ver
* [55e4f5b](https://github.com/hyperledger/fabric-sdk-node/commit/55e4f5b) [FAB-8827](https://jira.hyperledger.org/browse/FAB-8827) Add npm package badge in README
* [40b8e2c](https://github.com/hyperledger/fabric-sdk-node/commit/40b8e2c) [FAB-8764](https://jira.hyperledger.org/browse/FAB-8764) NodeSDK update jsrsasign
* [f3e6fef](https://github.com/hyperledger/fabric-sdk-node/commit/f3e6fef) [FAB-8723](https://jira.hyperledger.org/browse/FAB-8723) NodeSDK V1.0 - string env vars
* [ec8e649](https://github.com/hyperledger/fabric-sdk-node/commit/ec8e649) [FAB-8713](https://jira.hyperledger.org/browse/FAB-8713) NodeSDK - update blockdecoder
* [be13eb8](https://github.com/hyperledger/fabric-sdk-node/commit/be13eb8) [[FAB-8736](https://jira.hyperledger.org/browse/FAB-8736)] Fixes undefined methods in BlockDecoder
* [6b9302c](https://github.com/hyperledger/fabric-sdk-node/commit/6b9302c) [[FAB-8734](https://jira.hyperledger.org/browse/FAB-8734)]NodeSDK: Fix typo in log messages
* [000526d](https://github.com/hyperledger/fabric-sdk-node/commit/000526d) [[FAB-8714](https://jira.hyperledger.org/browse/FAB-8714)] Corrects typo error in BlockDecoder
* [91a0afa](https://github.com/hyperledger/fabric-sdk-node/commit/91a0afa) [FAB-8580](https://jira.hyperledger.org/browse/FAB-8580) NodeSDK - add metadata tutorial
* [b911bdf](https://github.com/hyperledger/fabric-sdk-node/commit/b911bdf) [[FAB-8377](https://jira.hyperledger.org/browse/FAB-8377)] Add doc for mutual TLS
* [5e1e3e1](https://github.com/hyperledger/fabric-sdk-node/commit/5e1e3e1) [FAB-8678](https://jira.hyperledger.org/browse/FAB-8678) NodeSDK - packager missing logger
* [0275031](https://github.com/hyperledger/fabric-sdk-node/commit/0275031) [[FAB-8652](https://jira.hyperledger.org/browse/FAB-8652)] update invalid link
* [e885480](https://github.com/hyperledger/fabric-sdk-node/commit/e885480) [[FAB-8651](https://jira.hyperledger.org/browse/FAB-8651)] KeyInfo decode calls keyIdentifier
* [d7c0754](https://github.com/hyperledger/fabric-sdk-node/commit/d7c0754) [[FAB-8650](https://jira.hyperledger.org/browse/FAB-8650)] remove unused import for 'fabric-ca-client'
* [235d545](https://github.com/hyperledger/fabric-sdk-node/commit/235d545) [[FAB-5087](https://jira.hyperledger.org/browse/FAB-5087)] NodeSDK - Add the "queryBlockByTxID" method
* [15bc707](https://github.com/hyperledger/fabric-sdk-node/commit/15bc707) [FAB-8592](https://jira.hyperledger.org/browse/FAB-8592) NodeSDK - return status info
* [03cfcd1](https://github.com/hyperledger/fabric-sdk-node/commit/03cfcd1) [[FAB-6599](https://jira.hyperledger.org/browse/FAB-6599)] fix node-sdk gulp error
* [634684c](https://github.com/hyperledger/fabric-sdk-node/commit/634684c) [FAB-8619](https://jira.hyperledger.org/browse/FAB-8619) NodeSDK - update connection profile doc
* [ae7fdcc](https://github.com/hyperledger/fabric-sdk-node/commit/ae7fdcc) [FAB-8579](https://jira.hyperledger.org/browse/FAB-8579) NodeSDK - get config from peer
* [aab8250](https://github.com/hyperledger/fabric-sdk-node/commit/aab8250) [FAB-5398](https://jira.hyperledger.org/browse/FAB-5398) NodeSDK release notes - install issue
* [d11a1f0](https://github.com/hyperledger/fabric-sdk-node/commit/d11a1f0) [FAB-8563](https://jira.hyperledger.org/browse/FAB-8563) NodeSDK - enable mutual TLS
* [3664921](https://github.com/hyperledger/fabric-sdk-node/commit/3664921) [FAB-8550](https://jira.hyperledger.org/browse/FAB-8550) NodeSDK - add client metadataPath
* [1a37371](https://github.com/hyperledger/fabric-sdk-node/commit/1a37371) [[FAB-8345](https://jira.hyperledger.org/browse/FAB-8345)] Package chaincode metadata descriptors
* [d044103](https://github.com/hyperledger/fabric-sdk-node/commit/d044103) [[FAB-8519](https://jira.hyperledger.org/browse/FAB-8519)] Update test to match updated LSCC error
* [c588703](https://github.com/hyperledger/fabric-sdk-node/commit/c588703) [[FAB-8232](https://jira.hyperledger.org/browse/FAB-8232)] fix eslint error and undefined variable
* [49b3ff1](https://github.com/hyperledger/fabric-sdk-node/commit/49b3ff1) [FAB-8470](https://jira.hyperledger.org/browse/FAB-8470) NodeSDK 1.1 - grpc settings
* [c2c0504](https://github.com/hyperledger/fabric-sdk-node/commit/c2c0504) [FAB-8400](https://jira.hyperledger.org/browse/FAB-8400) NodeSDK - Update dependencies
* [5bdd466](https://github.com/hyperledger/fabric-sdk-node/commit/5bdd466) [[FAB-8456](https://jira.hyperledger.org/browse/FAB-8456)] Document known vulnerabilties
* [9a2d489](https://github.com/hyperledger/fabric-sdk-node/commit/9a2d489) [FAB-8399](https://jira.hyperledger.org/browse/FAB-8399) use specified thirdparty docker image in tests
* [74bfcdd](https://github.com/hyperledger/fabric-sdk-node/commit/74bfcdd) [FAB-2787](https://jira.hyperledger.org/browse/FAB-2787) NodeSDK - Evnethub options
* [f4826bd](https://github.com/hyperledger/fabric-sdk-node/commit/f4826bd) [FAB-8351](https://jira.hyperledger.org/browse/FAB-8351) NodeSDK - add parms to PKCS11
* [4b8617b](https://github.com/hyperledger/fabric-sdk-node/commit/4b8617b) [[FAB-8452](https://jira.hyperledger.org/browse/FAB-8452)]improve test coverage for IdentityService
* [64d0979](https://github.com/hyperledger/fabric-sdk-node/commit/64d0979) [[FAB-8420](https://jira.hyperledger.org/browse/FAB-8420)]Improve test coverage for AffiliationService
* [80af109](https://github.com/hyperledger/fabric-sdk-node/commit/80af109) [[FAB-8385](https://jira.hyperledger.org/browse/FAB-8385)] Enable V1.1 capabilities during bootstrap
* [d1bdc39](https://github.com/hyperledger/fabric-sdk-node/commit/d1bdc39) [FAB-8406](https://jira.hyperledger.org/browse/FAB-8406) NodeSDK Support PEER role
* [424d65f](https://github.com/hyperledger/fabric-sdk-node/commit/424d65f) [[FAB-8415](https://jira.hyperledger.org/browse/FAB-8415)] Fixing TLS expired certificates
* [bd62382](https://github.com/hyperledger/fabric-sdk-node/commit/bd62382) [FAB-2787](https://jira.hyperledger.org/browse/FAB-2787) NodeSDK - add min ping interval
* [646c96d](https://github.com/hyperledger/fabric-sdk-node/commit/646c96d) [FAB-8364](https://jira.hyperledger.org/browse/FAB-8364) update baseimage version to 0.4.6
* [bdbbb67](https://github.com/hyperledger/fabric-sdk-node/commit/bdbbb67) [[FAB-8353](https://jira.hyperledger.org/browse/FAB-8353)] - Change the transient map debug log
* [90881bb](https://github.com/hyperledger/fabric-sdk-node/commit/90881bb) [[FAB-7654](https://jira.hyperledger.org/browse/FAB-7654)] Run PKCS11 tests w/o root privileges
* [5b9b75e](https://github.com/hyperledger/fabric-sdk-node/commit/5b9b75e) [[FAB-8329](https://jira.hyperledger.org/browse/FAB-8329)]Fix parameter in transaction proposal request
* [0ace8d1](https://github.com/hyperledger/fabric-sdk-node/commit/0ace8d1) [[FAB-8308](https://jira.hyperledger.org/browse/FAB-8308)][sdk-node]Fix broken link in README.md
* [8a33991](https://github.com/hyperledger/fabric-sdk-node/commit/8a33991) [[FAB-5492](https://jira.hyperledger.org/browse/FAB-5492)] Migrate to ES6 syntax const/let from var
* [a7dc4d3](https://github.com/hyperledger/fabric-sdk-node/commit/a7dc4d3) [[FAB-8229](https://jira.hyperledger.org/browse/FAB-8229)] Set orderer's name from network profile
* [fcc3f65](https://github.com/hyperledger/fabric-sdk-node/commit/fcc3f65) [[FAB-8217](https://jira.hyperledger.org/browse/FAB-8217)] Removes unused proto from BlockDecoder
* [352174e](https://github.com/hyperledger/fabric-sdk-node/commit/352174e) [[FAB-8128](https://jira.hyperledger.org/browse/FAB-8128)] Fix ESLint config
* [e7b89bc](https://github.com/hyperledger/fabric-sdk-node/commit/e7b89bc) [[FAB-8058](https://jira.hyperledger.org/browse/FAB-8058)] typo fix and logging align
* [541cb82](https://github.com/hyperledger/fabric-sdk-node/commit/541cb82) [[FAB-8087](https://jira.hyperledger.org/browse/FAB-8087)] Remove reference to private repo
* [5aebf20](https://github.com/hyperledger/fabric-sdk-node/commit/5aebf20) [[FAB-7944](https://jira.hyperledger.org/browse/FAB-7944)] fabric-client ignores value for hfc-logging
* [dd50831](https://github.com/hyperledger/fabric-sdk-node/commit/dd50831) [[FAB-7962](https://jira.hyperledger.org/browse/FAB-7962)] Update type information for TypeScript
* [3473157](https://github.com/hyperledger/fabric-sdk-node/commit/3473157) [FAB-7787](https://jira.hyperledger.org/browse/FAB-7787) prepare fabric-sdk-node for next release

## v1.1.0-alpha
Fri Jan 26 19:09:53 EST 2018

* [111ce4f](https://github.com/hyperledger/fabric-sdk-node/commit/111ce4f) [FAB-7784](https://jira.hyperledger.org/browse/FAB-7784) prepare fabric-sdk-node for 1.1.0-alpha
* [097c1e0](https://github.com/hyperledger/fabric-sdk-node/commit/097c1e0) [[FAB-6628](https://jira.hyperledger.org/browse/FAB-6628)] 2. Support affiliation REST API
* [a149e0e](https://github.com/hyperledger/fabric-sdk-node/commit/a149e0e) [FAB-7925](https://jira.hyperledger.org/browse/FAB-7925) fix couchdb version
* [bdab3b5](https://github.com/hyperledger/fabric-sdk-node/commit/bdab3b5) [FAB-7642](https://jira.hyperledger.org/browse/FAB-7642) NodeSDK update doc
* [31fe394](https://github.com/hyperledger/fabric-sdk-node/commit/31fe394) [FAB-6628](https://jira.hyperledger.org/browse/FAB-6628) NodeSDK - identitiesy REST change
* [95d4f48](https://github.com/hyperledger/fabric-sdk-node/commit/95d4f48) [[FAB-7860](https://jira.hyperledger.org/browse/FAB-7860)] Replace console.log with logger.debug
* [7ce03e2](https://github.com/hyperledger/fabric-sdk-node/commit/7ce03e2) [[FAB-7859](https://jira.hyperledger.org/browse/FAB-7859)] Client.createUser does not support PKCS11
* [1d48529](https://github.com/hyperledger/fabric-sdk-node/commit/1d48529) [[FAB-6628](https://jira.hyperledger.org/browse/FAB-6628)] 1. Support identities REST API
* [749873a](https://github.com/hyperledger/fabric-sdk-node/commit/749873a) [FAB-7642](https://jira.hyperledger.org/browse/FAB-7642) NodeSDK - connection profile events
* [9b5f32b](https://github.com/hyperledger/fabric-sdk-node/commit/9b5f32b) [FAB-6400](https://jira.hyperledger.org/browse/FAB-6400) NodeSDK - add filtered event doc
* [20bdc4d](https://github.com/hyperledger/fabric-sdk-node/commit/20bdc4d) [FAB-5481](https://jira.hyperledger.org/browse/FAB-5481) - NodeSDK - Filtered events
* [283cdd4](https://github.com/hyperledger/fabric-sdk-node/commit/283cdd4) [[FAB-7726](https://jira.hyperledger.org/browse/FAB-7726)] Fix PKCS11 implementation
* [2ce1ece](https://github.com/hyperledger/fabric-sdk-node/commit/2ce1ece) [[FAB-7514](https://jira.hyperledger.org/browse/FAB-7514)] NodeSDK add unability to channel events
* [945fa8b](https://github.com/hyperledger/fabric-sdk-node/commit/945fa8b) [FAB-6400](https://jira.hyperledger.org/browse/FAB-6400) NodeSDK - filtered events
* [ef0c3f7](https://github.com/hyperledger/fabric-sdk-node/commit/ef0c3f7) [[FAB-7504](https://jira.hyperledger.org/browse/FAB-7504)] Fix Client.getPeersForOrgOnChannela fcn
* [f2a3fd6](https://github.com/hyperledger/fabric-sdk-node/commit/f2a3fd6) [FAB-6390](https://jira.hyperledger.org/browse/FAB-6390)] NodeSDK - Channel Event Service
* [115548f](https://github.com/hyperledger/fabric-sdk-node/commit/115548f) [[FAB-7447](https://jira.hyperledger.org/browse/FAB-7447)] NodeSDK - fabric message change
* [4d1256f](https://github.com/hyperledger/fabric-sdk-node/commit/4d1256f) [[FAB-6387](https://jira.hyperledger.org/browse/FAB-6387)] Temporary fix response value
* [f752608](https://github.com/hyperledger/fabric-sdk-node/commit/f752608) [[FAB-4824](https://jira.hyperledger.org/browse/FAB-4824)] NodeSDK - event replay
* [88e6b90](https://github.com/hyperledger/fabric-sdk-node/commit/88e6b90) [FAB-6266](https://jira.hyperledger.org/browse/FAB-6266): fix SSL errors with multiple peers
* [4d4d939](https://github.com/hyperledger/fabric-sdk-node/commit/4d4d939) Establish node SDK's own list of maintainers
* [1941ef8](https://github.com/hyperledger/fabric-sdk-node/commit/1941ef8) [[FAB-5117](https://jira.hyperledger.org/browse/FAB-5117)] NodeSDK - grpc dflt send/receive size
* [cfd6815](https://github.com/hyperledger/fabric-sdk-node/commit/cfd6815) [[FAB-7010](https://jira.hyperledger.org/browse/FAB-7010)] NodeSDK - handle fabric-ca change
* [ea6d167](https://github.com/hyperledger/fabric-sdk-node/commit/ea6d167) [[FAB-6968](https://jira.hyperledger.org/browse/FAB-6968)] Replace deprecated Buffer constructors
* [1f03242](https://github.com/hyperledger/fabric-sdk-node/commit/1f03242) [[FAB-6971](https://jira.hyperledger.org/browse/FAB-6971)] GRPC_SSL_CIPHER_SUITES not correctly set
* [70a7b13](https://github.com/hyperledger/fabric-sdk-node/commit/70a7b13) [[FAB-6958](https://jira.hyperledger.org/browse/FAB-6958)] Use built-in SHA256 implementation
* [a157dce](https://github.com/hyperledger/fabric-sdk-node/commit/a157dce) [[FAB-6960](https://jira.hyperledger.org/browse/FAB-6960)] Update sjcl to latest version
* [0fc518d](https://github.com/hyperledger/fabric-sdk-node/commit/0fc518d) [[FAB-5805](https://jira.hyperledger.org/browse/FAB-5805)] NodeSDK - fix config load
* [1815caf](https://github.com/hyperledger/fabric-sdk-node/commit/1815caf) [[FAB-5117](https://jira.hyperledger.org/browse/FAB-5117)] NodeSDK - grpc dflt send/receive size
* [a5934f7](https://github.com/hyperledger/fabric-sdk-node/commit/a5934f7) [FAB-6909](https://jira.hyperledger.org/browse/FAB-6909) upgrade support to 8.9.0 (new LTS)
* [6214f05](https://github.com/hyperledger/fabric-sdk-node/commit/6214f05) [[FAB-6062](https://jira.hyperledger.org/browse/FAB-6062)] NodeSDK - add close method
* [431df8a](https://github.com/hyperledger/fabric-sdk-node/commit/431df8a) [[FAB-6412](https://jira.hyperledger.org/browse/FAB-6412)] Add Node SDK support for gencrl endpoint
* [588553a](https://github.com/hyperledger/fabric-sdk-node/commit/588553a) [[FAB-6820](https://jira.hyperledger.org/browse/FAB-6820)] Support mutual TLS for peer/orderer
* [faca928](https://github.com/hyperledger/fabric-sdk-node/commit/faca928) [[FAB-6468](https://jira.hyperledger.org/browse/FAB-6468)] NodeSDK - normalize certs
* [99129bc](https://github.com/hyperledger/fabric-sdk-node/commit/99129bc) [[FAB-6709](https://jira.hyperledger.org/browse/FAB-6709)] NodeSDK get default channel
* [2010fda](https://github.com/hyperledger/fabric-sdk-node/commit/2010fda) [[FAB-6882](https://jira.hyperledger.org/browse/FAB-6882)] NodeSDK - update protos
* [43fb29d](https://github.com/hyperledger/fabric-sdk-node/commit/43fb29d) [FAB-6827](https://jira.hyperledger.org/browse/FAB-6827) prepare fabric-sdk-node for next release
* [2425eab](https://github.com/hyperledger/fabric-sdk-node/commit/2425eab) [[FAB-6551](https://jira.hyperledger.org/browse/FAB-6551)] NodeSDK - maxEnrollment
* [7e7d0f0](https://github.com/hyperledger/fabric-sdk-node/commit/7e7d0f0) [[FAB-5377](https://jira.hyperledger.org/browse/FAB-5377)] response with payload in fabric-sdk-node

## v1.1.0-preview
Wed Nov  1 10:28:19 EDT 2017

* [d59b926](https://github.com/hyperledger/fabric-sdk-node/commit/d59b926) [[FAB-5363](https://jira.hyperledger.org/browse/FAB-5363)] NodeSDK - add common config doc
* [f534a3a](https://github.com/hyperledger/fabric-sdk-node/commit/f534a3a) [[FAB-6707](https://jira.hyperledger.org/browse/FAB-6707)] NodeSDK - getCertificate auth
* [0fca3f5](https://github.com/hyperledger/fabric-sdk-node/commit/0fca3f5) [[FAB-6706](https://jira.hyperledger.org/browse/FAB-6706)] NodeSDK - handle null verify property
* [2161c2b](https://github.com/hyperledger/fabric-sdk-node/commit/2161c2b) [[FAB-6679](https://jira.hyperledger.org/browse/FAB-6679)] NodeSDK - CCP timeouts
* [40dc5b0](https://github.com/hyperledger/fabric-sdk-node/commit/40dc5b0) [[FAB-6458](https://jira.hyperledger.org/browse/FAB-6458)] Throw Error if chaincode path does not exist
* [1060568](https://github.com/hyperledger/fabric-sdk-node/commit/1060568) [[FAB-6609](https://jira.hyperledger.org/browse/FAB-6609)] add an option key 'skipPersistence'
* [adac58b](https://github.com/hyperledger/fabric-sdk-node/commit/adac58b) [[FAB-6656](https://jira.hyperledger.org/browse/FAB-6656)] NodeSDK - auto pick targets on install
* [6d99a83](https://github.com/hyperledger/fabric-sdk-node/commit/6d99a83) [[FAB-6653](https://jira.hyperledger.org/browse/FAB-6653)] NodeSDK - quick access to mspid
* [dafb979](https://github.com/hyperledger/fabric-sdk-node/commit/dafb979) [[FAB-6652](https://jira.hyperledger.org/browse/FAB-6652)] NodeSDK - access client config
* [8a41d53](https://github.com/hyperledger/fabric-sdk-node/commit/8a41d53) [[FAB-6668](https://jira.hyperledger.org/browse/FAB-6668)] Update AttributeRequest type definition
* [0c9ebd1](https://github.com/hyperledger/fabric-sdk-node/commit/0c9ebd1) [[FAB-6654](https://jira.hyperledger.org/browse/FAB-6654)] NodeSDK - get eventhubs for org
* [ab7634b](https://github.com/hyperledger/fabric-sdk-node/commit/ab7634b) [[FAB-6480](https://jira.hyperledger.org/browse/FAB-6480)] NodeSDK - readable block numbers
* [b641c35](https://github.com/hyperledger/fabric-sdk-node/commit/b641c35) [[FAB-6655](https://jira.hyperledger.org/browse/FAB-6655)] NodeSDK - all event const without user
* [c08ea0f](https://github.com/hyperledger/fabric-sdk-node/commit/c08ea0f) [[FAB-6658](https://jira.hyperledger.org/browse/FAB-6658)] NodeSDK - add caName to ca client
* [95599c0](https://github.com/hyperledger/fabric-sdk-node/commit/95599c0) [[FAB-6612](https://jira.hyperledger.org/browse/FAB-6612)] Handle Windows tempdir in node-sdk test
* [49b6f44](https://github.com/hyperledger/fabric-sdk-node/commit/49b6f44) [[FAB-6420](https://jira.hyperledger.org/browse/FAB-6420)] NodeSDK - remove NPM warnings
* [c1db676](https://github.com/hyperledger/fabric-sdk-node/commit/c1db676) [[FAB-5581](https://jira.hyperledger.org/browse/FAB-5581)] Misc corrrections and updates to the typings
* [6cb1777](https://github.com/hyperledger/fabric-sdk-node/commit/6cb1777) [[FAB-6425](https://jira.hyperledger.org/browse/FAB-6425)] NodeSDK - fix grpc dependency
* [229c0fa](https://github.com/hyperledger/fabric-sdk-node/commit/229c0fa) [[FAB-6507](https://jira.hyperledger.org/browse/FAB-6507)] NodeSDK - add caname
* [0939fe4](https://github.com/hyperledger/fabric-sdk-node/commit/0939fe4) [FAB-6506](https://jira.hyperledger.org/browse/FAB-6506) change coverage support to node 8
* [3c8ec76](https://github.com/hyperledger/fabric-sdk-node/commit/3c8ec76) [[FAB-6471](https://jira.hyperledger.org/browse/FAB-6471)] NodeSDK - remove header return
* [1e3ce1d](https://github.com/hyperledger/fabric-sdk-node/commit/1e3ce1d) [[FAB-6469](https://jira.hyperledger.org/browse/FAB-6469)] NodeSDK - keepalive set to 6min
* [ceb8327](https://github.com/hyperledger/fabric-sdk-node/commit/ceb8327) [[FAB-5346](https://jira.hyperledger.org/browse/FAB-5346)] NodeSDK - test CA cert attrs
* [3d92b61](https://github.com/hyperledger/fabric-sdk-node/commit/3d92b61) [[FAB-5581](https://jira.hyperledger.org/browse/FAB-5581)] Typescript definitions for fabric-client
* [c84d3b3](https://github.com/hyperledger/fabric-sdk-node/commit/c84d3b3) [[FAB-6396](https://jira.hyperledger.org/browse/FAB-6396)] NodeSDK - eventHub not recover
* [624553d](https://github.com/hyperledger/fabric-sdk-node/commit/624553d) [[FAB-6061](https://jira.hyperledger.org/browse/FAB-6061)] NodeSDK - rewrites user keys
* [b879829](https://github.com/hyperledger/fabric-sdk-node/commit/b879829) [FAB-6310](https://jira.hyperledger.org/browse/FAB-6310) use .npmignore for node CC packaging
* [57af0ec](https://github.com/hyperledger/fabric-sdk-node/commit/57af0ec) [[FAB-5346](https://jira.hyperledger.org/browse/FAB-5346)] NodeSDK - add CA attribute test
* [0c8b91e](https://github.com/hyperledger/fabric-sdk-node/commit/0c8b91e) [[FAB-5375](https://jira.hyperledger.org/browse/FAB-5375)] SDK support for node.js chaincode
* [582b981](https://github.com/hyperledger/fabric-sdk-node/commit/582b981) [[FAB-6217](https://jira.hyperledger.org/browse/FAB-6217)] NodeSDK - timeout not being passed
* [9c7afc2](https://github.com/hyperledger/fabric-sdk-node/commit/9c7afc2) [[FAB-6180](https://jira.hyperledger.org/browse/FAB-6180)] NodeSDK - add async/await testcase
* [b1b61a7](https://github.com/hyperledger/fabric-sdk-node/commit/b1b61a7) [FAB-6147](https://jira.hyperledger.org/browse/FAB-6147) Add build status badge in README
* [5013dfd](https://github.com/hyperledger/fabric-sdk-node/commit/5013dfd) [[FAB-5697](https://jira.hyperledger.org/browse/FAB-5697)] NodeSDK - make type not required
* [33dd444](https://github.com/hyperledger/fabric-sdk-node/commit/33dd444) [[FAB-5825](https://jira.hyperledger.org/browse/FAB-5825)] NodeSDK - fabric-ca-client attrib req
* [d8b851e](https://github.com/hyperledger/fabric-sdk-node/commit/d8b851e) [[FAB-5837](https://jira.hyperledger.org/browse/FAB-5837)] NodeSDK - update with latest protos
* [1fbb406](https://github.com/hyperledger/fabric-sdk-node/commit/1fbb406) [FAB-5959](https://jira.hyperledger.org/browse/FAB-5959) update README with build status URL's
* [13aa7a9](https://github.com/hyperledger/fabric-sdk-node/commit/13aa7a9) [[FAB-5974](https://jira.hyperledger.org/browse/FAB-5974)] NodeSDK - merge setUsers methods
* [9c1aced](https://github.com/hyperledger/fabric-sdk-node/commit/9c1aced) [FAB-6052](https://jira.hyperledger.org/browse/FAB-6052) Change versions to 1.1.0-snapshot
* [98d3063](https://github.com/hyperledger/fabric-sdk-node/commit/98d3063) [FAB-6038](https://jira.hyperledger.org/browse/FAB-6038) fabric-ca registration test failure
* [a7d1e06](https://github.com/hyperledger/fabric-sdk-node/commit/a7d1e06) [FAB-5879](https://jira.hyperledger.org/browse/FAB-5879) Add support for node 8 in addition to 6
* [d698c57](https://github.com/hyperledger/fabric-sdk-node/commit/d698c57) Clean deadcode in FileKeyValueStore.js
* [e2428ef](https://github.com/hyperledger/fabric-sdk-node/commit/e2428ef) [[FAB-5363](https://jira.hyperledger.org/browse/FAB-5363)] NodeSDK - common config part 2
* [4e437bd](https://github.com/hyperledger/fabric-sdk-node/commit/4e437bd) [FAB-5896](https://jira.hyperledger.org/browse/FAB-5896) Security implications documentation
* [1e61110](https://github.com/hyperledger/fabric-sdk-node/commit/1e61110) [[FAB-5363](https://jira.hyperledger.org/browse/FAB-5363)] NodeSDK - common config part 1
* [febff14](https://github.com/hyperledger/fabric-sdk-node/commit/febff14) [FAB-5885](https://jira.hyperledger.org/browse/FAB-5885) per-request timeout
* [d8c05c1](https://github.com/hyperledger/fabric-sdk-node/commit/d8c05c1) [[FAB-5597](https://jira.hyperledger.org/browse/FAB-5597)] typos in doc and log messages
* [524edee](https://github.com/hyperledger/fabric-sdk-node/commit/524edee) [[FAB-5775](https://jira.hyperledger.org/browse/FAB-5775)] Update grpc module >= 1.3.5
* [9fe8114](https://github.com/hyperledger/fabric-sdk-node/commit/9fe8114) [FAB-5698](https://jira.hyperledger.org/browse/FAB-5698) Prepare fabric-sdk-node for v1.0.2
* [f426239](https://github.com/hyperledger/fabric-sdk-node/commit/f426239) [[FAB-5409](https://jira.hyperledger.org/browse/FAB-5409)] JSDoc, Add targets to installChaincode() req
* [4a5afa2](https://github.com/hyperledger/fabric-sdk-node/commit/4a5afa2) [[FAB-5457](https://jira.hyperledger.org/browse/FAB-5457)] NodeSDK - block decode fails
* [3fed45a](https://github.com/hyperledger/fabric-sdk-node/commit/3fed45a) [[FAB-5447](https://jira.hyperledger.org/browse/FAB-5447)] NodeSDK - do not include orderer msp
* [608c05c](https://github.com/hyperledger/fabric-sdk-node/commit/608c05c) [[FAB-5410](https://jira.hyperledger.org/browse/FAB-5410)] JSDoc, Change chaincodeProposal to proposal
* [7a7db13](https://github.com/hyperledger/fabric-sdk-node/commit/7a7db13) [[FAB-5403](https://jira.hyperledger.org/browse/FAB-5403)] JSDoc, Remove txId from queryByChaincode
* [64fb795](https://github.com/hyperledger/fabric-sdk-node/commit/64fb795) [[FAB-5395](https://jira.hyperledger.org/browse/FAB-5395)] Fix a misspelled word
* [34dd649](https://github.com/hyperledger/fabric-sdk-node/commit/34dd649) [[FAB-4847](https://jira.hyperledger.org/browse/FAB-4847)] remove node-x509 dependency
* [326d0b1](https://github.com/hyperledger/fabric-sdk-node/commit/326d0b1) [[FAB-5382](https://jira.hyperledger.org/browse/FAB-5382)] Add a promise return to method's JSDoc
* [8ff1bf7](https://github.com/hyperledger/fabric-sdk-node/commit/8ff1bf7) [[FAB-5248](https://jira.hyperledger.org/browse/FAB-5248)] Basic performance tests
* [f56a124](https://github.com/hyperledger/fabric-sdk-node/commit/f56a124) [[FAB-5338](https://jira.hyperledger.org/browse/FAB-5338)] Add test for upgrade CC with state changes
* [7ced8d8](https://github.com/hyperledger/fabric-sdk-node/commit/7ced8d8) [Fab-5309] NodeSDK - regen artifacts
* [bf2f388](https://github.com/hyperledger/fabric-sdk-node/commit/bf2f388) [[FAB-5026](https://jira.hyperledger.org/browse/FAB-5026)] NodeSDK - verify install error
* [328e7c4](https://github.com/hyperledger/fabric-sdk-node/commit/328e7c4) [[FAB-5324](https://jira.hyperledger.org/browse/FAB-5324)] Minor jsdoc fixes
* [24777e1](https://github.com/hyperledger/fabric-sdk-node/commit/24777e1) [[FAB-5321](https://jira.hyperledger.org/browse/FAB-5321)] NodeSDK - trans status missing
* [12184fc](https://github.com/hyperledger/fabric-sdk-node/commit/12184fc) fix /lib/channel.js error
* [aed892f](https://github.com/hyperledger/fabric-sdk-node/commit/aed892f) [[FAB-2538](https://jira.hyperledger.org/browse/FAB-2538)] NodeSDK - endorsement error msg
* [4b7ec2f](https://github.com/hyperledger/fabric-sdk-node/commit/4b7ec2f) [[FAB-5048](https://jira.hyperledger.org/browse/FAB-5048)-medium] NodeSDK - add to package.json
* [d11bd77](https://github.com/hyperledger/fabric-sdk-node/commit/d11bd77) [[FAB-4453](https://jira.hyperledger.org/browse/FAB-4453)] Remove unused chaincodePath from test codes
* [12160fb](https://github.com/hyperledger/fabric-sdk-node/commit/12160fb) [[FAB-5212](https://jira.hyperledger.org/browse/FAB-5212)][node-sdk]Fix tls_cacerts path in e2e test
* [e60a3dc](https://github.com/hyperledger/fabric-sdk-node/commit/e60a3dc) [[FAB-4587](https://jira.hyperledger.org/browse/FAB-4587)] Add test cases for "invoke chaincode"
* [9522ad6](https://github.com/hyperledger/fabric-sdk-node/commit/9522ad6) [[FAB-5255](https://jira.hyperledger.org/browse/FAB-5255)] Update jsdoc links
* [8271ca6](https://github.com/hyperledger/fabric-sdk-node/commit/8271ca6) [[FAB-5072](https://jira.hyperledger.org/browse/FAB-5072)] prepare fabric-sdk-node for next release
* [b9542f3](https://github.com/hyperledger/fabric-sdk-node/commit/b9542f3) [[FAB-2818](https://jira.hyperledger.org/browse/FAB-2818)] NodeSDK - add tutorials

## 1.0.2
Tue Sep  5 15:14:46 EDT 2017

* [1667327](https://github.com/hyperledger/fabric-sdk-node/commit/1667327) [FAB-5879](https://jira.hyperledger.org/browse/FAB-5879) Add support for node 8 in addition to 6
* [bdd97f3](https://github.com/hyperledger/fabric-sdk-node/commit/bdd97f3) Clean deadcode in FileKeyValueStore.js
* [79d5bc9](https://github.com/hyperledger/fabric-sdk-node/commit/79d5bc9) [FAB-5896](https://jira.hyperledger.org/browse/FAB-5896) Security implications documentation
* [a4be9ba](https://github.com/hyperledger/fabric-sdk-node/commit/a4be9ba) [FAB-5885](https://jira.hyperledger.org/browse/FAB-5885) per-request timeout
* [66a8eef](https://github.com/hyperledger/fabric-sdk-node/commit/66a8eef) [[FAB-5597](https://jira.hyperledger.org/browse/FAB-5597)] typos in doc and log messages
* [9e003be](https://github.com/hyperledger/fabric-sdk-node/commit/9e003be) [[FAB-5775](https://jira.hyperledger.org/browse/FAB-5775)] Update grpc module >= 1.3.5

## v1.0.1
Wed Aug  9 15:58:10 EDT 2017

* [f426239](https://github.com/hyperledger/fabric-sdk-node/commit/f426239) [FAB-5409](https://jira.hyperledger.org/browse/FAB-5409) JSDoc, Add targets to installChaincode() req
* [4a5afa2](https://github.com/hyperledger/fabric-sdk-node/commit/4a5afa2) [FAB-5457](https://jira.hyperledger.org/browse/FAB-5457) NodeSDK - block decode fails
* [3fed45a](https://github.com/hyperledger/fabric-sdk-node/commit/3fed45a) [FAB-5447](https://jira.hyperledger.org/browse/FAB-5447) NodeSDK - do not include orderer msp
* [608c05c](https://github.com/hyperledger/fabric-sdk-node/commit/608c05c) [FAB-5410](https://jira.hyperledger.org/browse/FAB-5410) JSDoc, Change chaincodeProposal to proposal
* [7a7db13](https://github.com/hyperledger/fabric-sdk-node/commit/7a7db13) [FAB-5403](https://jira.hyperledger.org/browse/FAB-5403) JSDoc, Remove txId from queryByChaincode
* [64fb795](https://github.com/hyperledger/fabric-sdk-node/commit/64fb795) [FAB-5395](https://jira.hyperledger.org/browse/FAB-5395) Fix a misspelled word
* [34dd649](https://github.com/hyperledger/fabric-sdk-node/commit/34dd649) [FAB-4847](https://jira.hyperledger.org/browse/FAB-4847) remove node-x509 dependency
* [326d0b1](https://github.com/hyperledger/fabric-sdk-node/commit/326d0b1) [FAB-5382](https://jira.hyperledger.org/browse/FAB-5382) Add a promise return to method's JSDoc
* [8ff1bf7](https://github.com/hyperledger/fabric-sdk-node/commit/8ff1bf7) [FAB-5248](https://jira.hyperledger.org/browse/FAB-5248) Basic performance tests
* [f56a124](https://github.com/hyperledger/fabric-sdk-node/commit/f56a124) [FAB-5338](https://jira.hyperledger.org/browse/FAB-5338) Add test for upgrade CC with state changes
* [7ced8d8](https://github.com/hyperledger/fabric-sdk-node/commit/7ced8d8) [Fab-5309] NodeSDK - regen artifacts
* [bf2f388](https://github.com/hyperledger/fabric-sdk-node/commit/bf2f388) [FAB-5026](https://jira.hyperledger.org/browse/FAB-5026) NodeSDK - verify install error
* [328e7c4](https://github.com/hyperledger/fabric-sdk-node/commit/328e7c4) [FAB-5324](https://jira.hyperledger.org/browse/FAB-5324) Minor jsdoc fixes
* [24777e1](https://github.com/hyperledger/fabric-sdk-node/commit/24777e1) [FAB-5321](https://jira.hyperledger.org/browse/FAB-5321) NodeSDK - trans status missing
* [12184fc](https://github.com/hyperledger/fabric-sdk-node/commit/12184fc) fix /lib/channel.js error
* [aed892f](https://github.com/hyperledger/fabric-sdk-node/commit/aed892f) [FAB-2538](https://jira.hyperledger.org/browse/FAB-2538) NodeSDK - endorsement error msg
* [4b7ec2f](https://github.com/hyperledger/fabric-sdk-node/commit/4b7ec2f) [FAB-5048-medium] NodeSDK - add to package.json
* [d11bd77](https://github.com/hyperledger/fabric-sdk-node/commit/d11bd77) [FAB-4453](https://jira.hyperledger.org/browse/FAB-4453) Remove unused chaincodePath from test codes
* [12160fb](https://github.com/hyperledger/fabric-sdk-node/commit/12160fb) [FAB-5212](https://jira.hyperledger.org/browse/FAB-5212)[node-sdk]Fix tls_cacerts path in e2e test
* [e60a3dc](https://github.com/hyperledger/fabric-sdk-node/commit/e60a3dc) [FAB-4587](https://jira.hyperledger.org/browse/FAB-4587) Add test cases for "invoke chaincode"
* [9522ad6](https://github.com/hyperledger/fabric-sdk-node/commit/9522ad6) [FAB-5255](https://jira.hyperledger.org/browse/FAB-5255) Update jsdoc links
* [8271ca6](https://github.com/hyperledger/fabric-sdk-node/commit/8271ca6) [FAB-5072](https://jira.hyperledger.org/browse/FAB-5072) prepare fabric-sdk-node for next release
* [974bafc](https://github.com/hyperledger/fabric-sdk-node/commit/974bafc) [FAB-5068](https://jira.hyperledger.org/browse/FAB-5068) prepare fabric-sdk-node for release
* [b9542f3](https://github.com/hyperledger/fabric-sdk-node/commit/b9542f3) [FAB-2818](https://jira.hyperledger.org/browse/FAB-2818) NodeSDK - add tutorials

## v1.0.0
Tue Jul 11 12:19:53 EDT 2017

* [a865121](https://github.com/hyperledger/fabric-sdk-node/commit/a865121) [FAB-4996](https://jira.hyperledger.org/browse/FAB-4996) NodeSDK - move sample - part 2
* [95502b6](https://github.com/hyperledger/fabric-sdk-node/commit/95502b6) [FAB-4964](https://jira.hyperledger.org/browse/FAB-4964) NodeSDK - update test cases
* [16c9318](https://github.com/hyperledger/fabric-sdk-node/commit/16c9318) FAB-4525 prepare for rc2 development

## v1.0.0-rc1
Fri Jun 23 13:06:19 EDT 2017

* [b064869](https://github.com/hyperledger/fabric-sdk-node/commit/b064869) FAB-4521 prepare for v1.0.0-rc1 release
* [50d39ba](https://github.com/hyperledger/fabric-sdk-node/commit/50d39ba) [FAB-4923](https://jira.hyperledger.org/browse/FAB-4923) Enable balance-transfer for rc1
* [47a9286](https://github.com/hyperledger/fabric-sdk-node/commit/47a9286) [fab-4912] Modify e2e fixtures to support new MSP
* [9dc6490](https://github.com/hyperledger/fabric-sdk-node/commit/9dc6490) [FAB-4918](https://jira.hyperledger.org/browse/FAB-4918) NodeSDK - remove workaround
* [1b3d8a7](https://github.com/hyperledger/fabric-sdk-node/commit/1b3d8a7) [FAB-4852](https://jira.hyperledger.org/browse/FAB-4852) NodeSDK - fix doc broken links
* [7cf6176](https://github.com/hyperledger/fabric-sdk-node/commit/7cf6176) [FAB-4615](https://jira.hyperledger.org/browse/FAB-4615) NodeSDK - TransactionID doc
* [ada7f75](https://github.com/hyperledger/fabric-sdk-node/commit/ada7f75) [FAB-4882](https://jira.hyperledger.org/browse/FAB-4882) Bug fix in e2e query test
* [9e7d7ac](https://github.com/hyperledger/fabric-sdk-node/commit/9e7d7ac) [FAB-4878](https://jira.hyperledger.org/browse/FAB-4878) fcn name handling in sample app
* [9b8c6a0](https://github.com/hyperledger/fabric-sdk-node/commit/9b8c6a0) [FAB-4870](https://jira.hyperledger.org/browse/FAB-4870) Confusing fcn name handling in tests
* [9f9659f](https://github.com/hyperledger/fabric-sdk-node/commit/9f9659f) [FAB-4860](https://jira.hyperledger.org/browse/FAB-4860) BaseClient.js missing 'use strict'
* [2868120](https://github.com/hyperledger/fabric-sdk-node/commit/2868120) [FAB-4643](https://jira.hyperledger.org/browse/FAB-4643) NodeSDK - Work with the configtxlator
* [164b777](https://github.com/hyperledger/fabric-sdk-node/commit/164b777) [FAB-4456](https://jira.hyperledger.org/browse/FAB-4456) JSDoc cleanup and enhancement - part VI
* [dd49adb](https://github.com/hyperledger/fabric-sdk-node/commit/dd49adb) [FAB-4794](https://jira.hyperledger.org/browse/FAB-4794) NodeSDK - eventhub connect
* [08f55c3](https://github.com/hyperledger/fabric-sdk-node/commit/08f55c3) [FAB-4456](https://jira.hyperledger.org/browse/FAB-4456) JSDoc cleanup and enhancement - part V
* [8fb2968](https://github.com/hyperledger/fabric-sdk-node/commit/8fb2968) [FAB-4456](https://jira.hyperledger.org/browse/FAB-4456) JSDoc cleanup - part IV
* [6c3bfe6](https://github.com/hyperledger/fabric-sdk-node/commit/6c3bfe6) [FAB-4456](https://jira.hyperledger.org/browse/FAB-4456) JSDoc cleanup - part III
* [9ed6451](https://github.com/hyperledger/fabric-sdk-node/commit/9ed6451) [FAB-4456](https://jira.hyperledger.org/browse/FAB-4456) Fixup jsdoc - part II
* [0eeaa61](https://github.com/hyperledger/fabric-sdk-node/commit/0eeaa61) FAB-4573 add missing license headers
* [7185cdb](https://github.com/hyperledger/fabric-sdk-node/commit/7185cdb) [FAB-4483](https://jira.hyperledger.org/browse/FAB-4483) NodeSDK - intermittent errors
* [811474c](https://github.com/hyperledger/fabric-sdk-node/commit/811474c) [FAB-4486](https://jira.hyperledger.org/browse/FAB-4486)Improve integration test for "instantiate CC"
* [443bbef](https://github.com/hyperledger/fabric-sdk-node/commit/443bbef) [FAB-4456](https://jira.hyperledger.org/browse/FAB-4456) Fixup jsdoc - part I
* [84ebeb4](https://github.com/hyperledger/fabric-sdk-node/commit/84ebeb4) [FAB-4395](https://jira.hyperledger.org/browse/FAB-4395) Prepare for rc1 development
* [d8f52a8](https://github.com/hyperledger/fabric-sdk-node/commit/d8f52a8) [FAB-4446](https://jira.hyperledger.org/browse/FAB-4446) NodeSDK - test code invalid
* [a05c55c](https://github.com/hyperledger/fabric-sdk-node/commit/a05c55c) [FAB-4441](https://jira.hyperledger.org/browse/FAB-4441) NodeSDK update protos to current
* [a156a23](https://github.com/hyperledger/fabric-sdk-node/commit/a156a23) [FAB-4435](https://jira.hyperledger.org/browse/FAB-4435) gulp test recreates containers
* [2717d9b](https://github.com/hyperledger/fabric-sdk-node/commit/2717d9b) Fix indexing bug in installChaincode e2e test

## v1.0.0-beta
Thu Jun  8 07:11:33 EDT 2017

* [edbf91d](https://github.com/hyperledger/fabric-sdk-node/commit/edbf91d) [FAB-4393](https://jira.hyperledger.org/browse/FAB-4393) release notes for 1.0.0-beta
* [7d62c53](https://github.com/hyperledger/fabric-sdk-node/commit/7d62c53) [FAB-4284](https://jira.hyperledger.org/browse/FAB-4284) - Fix link to CA Overview
* [1b2930c](https://github.com/hyperledger/fabric-sdk-node/commit/1b2930c) [FAB-4283](https://jira.hyperledger.org/browse/FAB-4283) NodeSDK clean up
* [7358d0c](https://github.com/hyperledger/fabric-sdk-node/commit/7358d0c) [FAB-1592](https://jira.hyperledger.org/browse/FAB-1592) Delete marbles.js from integration test
* [de5a980](https://github.com/hyperledger/fabric-sdk-node/commit/de5a980) [FAB-4374](https://jira.hyperledger.org/browse/FAB-4374) NodeSDK - block decode return bytes
* [5d158e8](https://github.com/hyperledger/fabric-sdk-node/commit/5d158e8) [FAB-2787](https://jira.hyperledger.org/browse/FAB-2787) NodeSDK - Client timeout
* [63ea71d](https://github.com/hyperledger/fabric-sdk-node/commit/63ea71d) [FAB-4226](https://jira.hyperledger.org/browse/FAB-4226) Upgrade example app to beta level
* [af194a8](https://github.com/hyperledger/fabric-sdk-node/commit/af194a8) [FAB-4306](https://jira.hyperledger.org/browse/FAB-4306) signatures not able to save
* [f306afe](https://github.com/hyperledger/fabric-sdk-node/commit/f306afe) [FAB-4131](https://jira.hyperledger.org/browse/FAB-4131) Enhance FabricCAClientImpl with persistence
* [335f587](https://github.com/hyperledger/fabric-sdk-node/commit/335f587) [FAB-4308](https://jira.hyperledger.org/browse/FAB-4308) add missing CCBY license to docs
* [a494295](https://github.com/hyperledger/fabric-sdk-node/commit/a494295) [FAB-2991](https://jira.hyperledger.org/browse/FAB-2991) Improve query interfaces
* [4b6bd7a](https://github.com/hyperledger/fabric-sdk-node/commit/4b6bd7a) [FAB-4238](https://jira.hyperledger.org/browse/FAB-4238) install chaincode e2e test
* [ad807b3](https://github.com/hyperledger/fabric-sdk-node/commit/ad807b3) [FAB-4191](https://jira.hyperledger.org/browse/FAB-4191) Remove --peer-defaultchain from compose
* [e5f04ef](https://github.com/hyperledger/fabric-sdk-node/commit/e5f04ef) [FAB-4187](https://jira.hyperledger.org/browse/FAB-4187) Clean up unit test of sdk-node
* [68f7c04](https://github.com/hyperledger/fabric-sdk-node/commit/68f7c04) [FAB-3693](https://jira.hyperledger.org/browse/FAB-3693) Fix channel creation in new-channel.js
* [c856573](https://github.com/hyperledger/fabric-sdk-node/commit/c856573) [FAB-4165](https://jira.hyperledger.org/browse/FAB-4165) Fix gulp test to remove chaincode containers
* [123e595](https://github.com/hyperledger/fabric-sdk-node/commit/123e595) [FAB-4160](https://jira.hyperledger.org/browse/FAB-4160) NodeSDK - remove SDK channel create
* [183a619](https://github.com/hyperledger/fabric-sdk-node/commit/183a619) [FAB-4094](https://jira.hyperledger.org/browse/FAB-4094) Enable state-store-less-ness
* [959d99f](https://github.com/hyperledger/fabric-sdk-node/commit/959d99f) [FAB-4145](https://jira.hyperledger.org/browse/FAB-4145) intermittent e2e failure in fabric verify
* [105d16c](https://github.com/hyperledger/fabric-sdk-node/commit/105d16c) [FAB-4145](https://jira.hyperledger.org/browse/FAB-4145) intermittent e2e failure in fabric verify
* [bfdb8e5](https://github.com/hyperledger/fabric-sdk-node/commit/bfdb8e5) [FAB-4145](https://jira.hyperledger.org/browse/FAB-4145) intermittent e2e failure in fabric verify
* [c899119](https://github.com/hyperledger/fabric-sdk-node/commit/c899119) [FAB-2843](https://jira.hyperledger.org/browse/FAB-2843) NodeSDK - Handle network issues Part 2
* [ef61a8b](https://github.com/hyperledger/fabric-sdk-node/commit/ef61a8b) [FAB-3253](https://jira.hyperledger.org/browse/FAB-3253) Should attempt to load bccsp_pkcs11
* [9d3de19](https://github.com/hyperledger/fabric-sdk-node/commit/9d3de19) [FAB-4075](https://jira.hyperledger.org/browse/FAB-4075) Change APIs and code from Chain to Channel
* [392dd9f](https://github.com/hyperledger/fabric-sdk-node/commit/392dd9f) [FAB-2864](https://jira.hyperledger.org/browse/FAB-2864) Replace hashtable module
* [3ff53c4](https://github.com/hyperledger/fabric-sdk-node/commit/3ff53c4) node-SDK [FAB-2637](https://jira.hyperledger.org/browse/FAB-2637) assign PKCS11 libpath based on search
* [96b1b9f](https://github.com/hyperledger/fabric-sdk-node/commit/96b1b9f) [FAB-4014](https://jira.hyperledger.org/browse/FAB-4014) Remove chaincode version from invoke
* [6778314](https://github.com/hyperledger/fabric-sdk-node/commit/6778314) [FAB-3829](https://jira.hyperledger.org/browse/FAB-3829) Remove storekey param in cryptoSuite importKey
* [a01f72f](https://github.com/hyperledger/fabric-sdk-node/commit/a01f72f) [FAB-4054](https://jira.hyperledger.org/browse/FAB-4054) consolidate ca launch params
* [c3b5cb9](https://github.com/hyperledger/fabric-sdk-node/commit/c3b5cb9) [FAB-3568](https://jira.hyperledger.org/browse/FAB-3568) NodeSDK - Remove nonce requirement
* [33fb2b0](https://github.com/hyperledger/fabric-sdk-node/commit/33fb2b0) [FAB-4019](https://jira.hyperledger.org/browse/FAB-4019) Add newCryptoKeyStore to FabricCAClientImpl
* [9541aa4](https://github.com/hyperledger/fabric-sdk-node/commit/9541aa4) [FAB-2819](https://jira.hyperledger.org/browse/FAB-2819) Tutorial for app dev environment setup
* [696da1f](https://github.com/hyperledger/fabric-sdk-node/commit/696da1f) [FAB-4000](https://jira.hyperledger.org/browse/FAB-4000) balance-transasfer README corrections
* [88c0de6](https://github.com/hyperledger/fabric-sdk-node/commit/88c0de6) [FAB-3862](https://jira.hyperledger.org/browse/FAB-3862) Remove getRoles from Peer
* [6d5751a](https://github.com/hyperledger/fabric-sdk-node/commit/6d5751a) [FAB-3881](https://jira.hyperledger.org/browse/FAB-3881)  Remove local key store from Crypto
* [4506da9](https://github.com/hyperledger/fabric-sdk-node/commit/4506da9) [FAB-2843](https://jira.hyperledger.org/browse/FAB-2843) NodeSDK - Handle network issues part1
* [4b5a9b5](https://github.com/hyperledger/fabric-sdk-node/commit/4b5a9b5) [FAB-2726](https://jira.hyperledger.org/browse/FAB-2726) transform windows-style paths in CC package
* [5f3ebc8](https://github.com/hyperledger/fabric-sdk-node/commit/5f3ebc8) [FAB-3945](https://jira.hyperledger.org/browse/FAB-3945) Remove chainId from required params
* [67364a3](https://github.com/hyperledger/fabric-sdk-node/commit/67364a3) [FAB-3944](https://jira.hyperledger.org/browse/FAB-3944) renaming Chain.getOrganizationUnits()
* [c8706f9](https://github.com/hyperledger/fabric-sdk-node/commit/c8706f9) [FAB-3943](https://jira.hyperledger.org/browse/FAB-3943) Remove TCert methods from API
* [8846c0e](https://github.com/hyperledger/fabric-sdk-node/commit/8846c0e) [FAB-3935](https://jira.hyperledger.org/browse/FAB-3935) Add README to Balance-transfer sample
* [8e0c434](https://github.com/hyperledger/fabric-sdk-node/commit/8e0c434) Prepase for alpha2 development
* [6e1d2a5](https://github.com/hyperledger/fabric-sdk-node/commit/6e1d2a5) [FAB-3886](https://jira.hyperledger.org/browse/FAB-3886) Reduce steps to run gulp test
* [38eda84](https://github.com/hyperledger/fabric-sdk-node/commit/38eda84) [FAB-3868](https://jira.hyperledger.org/browse/FAB-3868) NodeSDK - update proto files to latest

## v1.0.0-alpha.1 April, 28 2017

* [7eaa632](https://github.com/hyperledger/fabric-sdk-node/commit/7eaa632) [FAB-3492](https://jira.hyperledger.org/browse/FAB-3492) Do not allow grpc 1.3.0 or greater

## v1.0.0-alpha March 16, 2017

* [196d048](https://github.com/hyperledger/fabric-sdk-node/commit/196d048) Release v1.0.0-alpha
* [238f2d2](https://github.com/hyperledger/fabric-sdk-node/commit/238f2d2) Fix query.js test code to be more deterministic
* [c71ee2c](https://github.com/hyperledger/fabric-sdk-node/commit/c71ee2c) NodeSDK - return error object from proposals
* [6f77cdf](https://github.com/hyperledger/fabric-sdk-node/commit/6f77cdf) [FAB-1552](https://jira.hyperledger.org/browse/FAB-1552) Implement TLS support for fabric-ca-client
* [3afcb0a](https://github.com/hyperledger/fabric-sdk-node/commit/3afcb0a) Add tls support to node SDK
* [378f37c](https://github.com/hyperledger/fabric-sdk-node/commit/378f37c) Require mspid in User.setEnrollment()
* [add5598](https://github.com/hyperledger/fabric-sdk-node/commit/add5598) [FAB-2760](https://jira.hyperledger.org/browse/FAB-2760) Update fabric-ca-client
* [e2edc9b](https://github.com/hyperledger/fabric-sdk-node/commit/e2edc9b) NodeSDK - update for latest protos
* [dcd7a3a](https://github.com/hyperledger/fabric-sdk-node/commit/dcd7a3a) nodeSDK include all integration tests in gulp test
* [6e792c5](https://github.com/hyperledger/fabric-sdk-node/commit/6e792c5) Update genesis blocks for orderer and chain
* [a945fd1](https://github.com/hyperledger/fabric-sdk-node/commit/a945fd1) Further updates to README
* [f38340b](https://github.com/hyperledger/fabric-sdk-node/commit/f38340b) Minor fix in readme
* [ad5831f](https://github.com/hyperledger/fabric-sdk-node/commit/ad5831f) Add event listener to chain genesis block commit
* [a8ce9ca](https://github.com/hyperledger/fabric-sdk-node/commit/a8ce9ca) 'npm test' command broke
* [2a0fa90](https://github.com/hyperledger/fabric-sdk-node/commit/2a0fa90) NodeSDK - update to latest proto
* [05c6f83](https://github.com/hyperledger/fabric-sdk-node/commit/05c6f83) Update readme and ca build task
* [2384471](https://github.com/hyperledger/fabric-sdk-node/commit/2384471) Add query to new multi-org end2end test
* [45a3778](https://github.com/hyperledger/fabric-sdk-node/commit/45a3778) Enhance the default endorsement policy
* [665fc61](https://github.com/hyperledger/fabric-sdk-node/commit/665fc61) Create default policy of 'Signed By any member of org'
* [0303e44](https://github.com/hyperledger/fabric-sdk-node/commit/0303e44) nodeSDK Fix gulp test
* [da119b5](https://github.com/hyperledger/fabric-sdk-node/commit/da119b5) Revert accidental changes to original end-to-end
* [b95036b](https://github.com/hyperledger/fabric-sdk-node/commit/b95036b) Update e2e test to use multi-org setup
* [240605b](https://github.com/hyperledger/fabric-sdk-node/commit/240605b) NodeSDK - add getOrganizationalUnits() to Chain
* [3063a5b](https://github.com/hyperledger/fabric-sdk-node/commit/3063a5b) Create test sandbox materials for channels
* [49f4eb7](https://github.com/hyperledger/fabric-sdk-node/commit/49f4eb7) [FAB-2493](https://jira.hyperledger.org/browse/FAB-2493) Use a streaming tar to package chaincode
* [771a723](https://github.com/hyperledger/fabric-sdk-node/commit/771a723) make sendInstantiateProposal be chaincodeType neutral
* [3fc729a](https://github.com/hyperledger/fabric-sdk-node/commit/3fc729a) Remove special handling of base64 padding
* [999db30](https://github.com/hyperledger/fabric-sdk-node/commit/999db30) NodeSDK update event and query to latest protopuf
* [b32920d](https://github.com/hyperledger/fabric-sdk-node/commit/b32920d) Only enforce chaincodePath for GOLANG
* [d3fcbe2](https://github.com/hyperledger/fabric-sdk-node/commit/d3fcbe2) BCCSP config back to SHA2
* [2579307](https://github.com/hyperledger/fabric-sdk-node/commit/2579307) Allow fabric-ca-client to use per-instance crypto
* [bc36ef5](https://github.com/hyperledger/fabric-sdk-node/commit/bc36ef5) Modify chaincode packaging to comply
* [fa135f3](https://github.com/hyperledger/fabric-sdk-node/commit/fa135f3) [FAB-2383](https://jira.hyperledger.org/browse/FAB-2383) Add queries for Blockchain App
* [d61f388](https://github.com/hyperledger/fabric-sdk-node/commit/d61f388) Reorganize the chaincode package logic
* [9b9599f](https://github.com/hyperledger/fabric-sdk-node/commit/9b9599f) Hash algorithms for signing and txId
* [6c3547e](https://github.com/hyperledger/fabric-sdk-node/commit/6c3547e) Cleanup filenames which used "cop"
* [50b9370](https://github.com/hyperledger/fabric-sdk-node/commit/50b9370) Update test/fixtures/docker-compose.yml
* [abd80fb](https://github.com/hyperledger/fabric-sdk-node/commit/abd80fb) Add more tests to register/enroll/revoke
* [651aac8](https://github.com/hyperledger/fabric-sdk-node/commit/651aac8) Implement fabric-ca revoke() client
* [c1daab4](https://github.com/hyperledger/fabric-sdk-node/commit/c1daab4) nodeSDK sendInstallProposal chaincodePackage
* [3473608](https://github.com/hyperledger/fabric-sdk-node/commit/3473608) Add authentication to register()
* [f7f39c2](https://github.com/hyperledger/fabric-sdk-node/commit/f7f39c2) Support .car deployment
* [28ba8ce](https://github.com/hyperledger/fabric-sdk-node/commit/28ba8ce) Fix devmode install
* [70fe8ad](https://github.com/hyperledger/fabric-sdk-node/commit/70fe8ad) node-sdk [FAB-2456](https://jira.hyperledger.org/browse/FAB-2456) query.js exited without ending
* [b42979f](https://github.com/hyperledger/fabric-sdk-node/commit/b42979f) Don't include init-args in InstallProposal
* [8c74e04](https://github.com/hyperledger/fabric-sdk-node/commit/8c74e04) Update events test for renamed API
* [425028f](https://github.com/hyperledger/fabric-sdk-node/commit/425028f) Remove unused node.js modules
* [c1372a7](https://github.com/hyperledger/fabric-sdk-node/commit/c1372a7) NodeSDK - new channel - join channel
* [f0c89b3](https://github.com/hyperledger/fabric-sdk-node/commit/f0c89b3) [FAB-2017](https://jira.hyperledger.org/browse/FAB-2017) Parse metadata for invalid transactions
* [2ba668c](https://github.com/hyperledger/fabric-sdk-node/commit/2ba668c) Fix fabric-ca-client tests
* [1c3f361](https://github.com/hyperledger/fabric-sdk-node/commit/1c3f361) NodeSDK update for latest protos
* [c34c643](https://github.com/hyperledger/fabric-sdk-node/commit/c34c643) Restore couchdb-fabricca test
* [1e3c1b2](https://github.com/hyperledger/fabric-sdk-node/commit/1e3c1b2) nodeSDK Rename Deployment to Instantiate
* [0344555](https://github.com/hyperledger/fabric-sdk-node/commit/0344555) nodeSDK Fix test failures
* [084d3b5](https://github.com/hyperledger/fabric-sdk-node/commit/084d3b5) NodeSDK Update to latest Protos
* [2b5907c](https://github.com/hyperledger/fabric-sdk-node/commit/2b5907c) TxID compute with nonce + creator
* [a8554c1](https://github.com/hyperledger/fabric-sdk-node/commit/a8554c1) CouchDBKeyValueStore ctor to ask for url
* [f6a374c](https://github.com/hyperledger/fabric-sdk-node/commit/f6a374c) Move t.end() calls earlier to avoid confusion
* [b394db1](https://github.com/hyperledger/fabric-sdk-node/commit/b394db1) [FAB-2352](https://jira.hyperledger.org/browse/FAB-2352) Upgrade grpc package to 1.1.x
* [f34cfce](https://github.com/hyperledger/fabric-sdk-node/commit/f34cfce) NodeSDK update queryTransaction with new proto
* [a4641aa](https://github.com/hyperledger/fabric-sdk-node/commit/a4641aa) node-sdk Implement new cc install / deploy
* [59a96ce](https://github.com/hyperledger/fabric-sdk-node/commit/59a96ce) node-SDK [FAB-2258](https://jira.hyperledger.org/browse/FAB-2258) restore HTML coverage report
* [d621497](https://github.com/hyperledger/fabric-sdk-node/commit/d621497) should use "=" to assign value rather than "-"
* [7702584](https://github.com/hyperledger/fabric-sdk-node/commit/7702584) Use mixin to enforce CryptoKeyStore APIs
* [691af63](https://github.com/hyperledger/fabric-sdk-node/commit/691af63) Refactor headless-tests.js into individual files
* [bdcd351](https://github.com/hyperledger/fabric-sdk-node/commit/bdcd351) node-SDK [FAB-2184](https://jira.hyperledger.org/browse/FAB-2184) Fix coucbdb-fabricca-tests.js
* [4ed80ae](https://github.com/hyperledger/fabric-sdk-node/commit/4ed80ae) add inline jsdoc to msp-manager
* [da1c9ba](https://github.com/hyperledger/fabric-sdk-node/commit/da1c9ba) Add Cobertura reports in gulp task
* [1f22ed9](https://github.com/hyperledger/fabric-sdk-node/commit/1f22ed9) NodeSDK - add Queries
* [ba20656](https://github.com/hyperledger/fabric-sdk-node/commit/ba20656) Implement MSPManager and load MSPs from configs
* [e10d4ec](https://github.com/hyperledger/fabric-sdk-node/commit/e10d4ec) node-SDK Fix [FAB-2158](https://jira.hyperledger.org/browse/FAB-2158) pkcs11-tests.js fails
* [d03960d](https://github.com/hyperledger/fabric-sdk-node/commit/d03960d) [FAB-2002](https://jira.hyperledger.org/browse/FAB-2002) Add unit test for chaincode events
* [024f6f0](https://github.com/hyperledger/fabric-sdk-node/commit/024f6f0) Allow per-chain variations of BCCSP/CryptoSuite
* [d83c5ae](https://github.com/hyperledger/fabric-sdk-node/commit/d83c5ae) node-SDK Fix [FAB-2154](https://jira.hyperledger.org/browse/FAB-2154) - add unit tests
* [56c54ee](https://github.com/hyperledger/fabric-sdk-node/commit/56c54ee) [FAB-2065](https://jira.hyperledger.org/browse/FAB-2065) Update balance-transfer sample app
* [d32cdd2](https://github.com/hyperledger/fabric-sdk-node/commit/d32cdd2) Remove keysize parameter from ecdsa/key ctor
* [59e88c6](https://github.com/hyperledger/fabric-sdk-node/commit/59e88c6) NodeSDK - update to latest protos
* [5e43972](https://github.com/hyperledger/fabric-sdk-node/commit/5e43972) node-SDK Fix [FAB-2109](https://jira.hyperledger.org/browse/FAB-2109) doc.js
* [4cdabba](https://github.com/hyperledger/fabric-sdk-node/commit/4cdabba) Create a keystore class for improved code flow
* [b9d5f26](https://github.com/hyperledger/fabric-sdk-node/commit/b9d5f26) Delete files checked in by accident
* [e64871f](https://github.com/hyperledger/fabric-sdk-node/commit/e64871f) Add checking for getKey(ski) returning pub key
* [dfbf9be](https://github.com/hyperledger/fabric-sdk-node/commit/dfbf9be) [FAB-2060](https://jira.hyperledger.org/browse/FAB-2060) Transmit chaincodePath during deployment
* [f8f4acd](https://github.com/hyperledger/fabric-sdk-node/commit/f8f4acd) istanbul config needs to be updated
* [0fd7d2c](https://github.com/hyperledger/fabric-sdk-node/commit/0fd7d2c) Fix missing package winston
* [77ff639](https://github.com/hyperledger/fabric-sdk-node/commit/77ff639) Update .gitignore
* [0f4075f](https://github.com/hyperledger/fabric-sdk-node/commit/0f4075f) Move tx listener registration before sending tx
* [7a54782](https://github.com/hyperledger/fabric-sdk-node/commit/7a54782) Re-format end-to-end test with lambda
* [a8ff8cd](https://github.com/hyperledger/fabric-sdk-node/commit/a8ff8cd) [FAB-678](https://jira.hyperledger.org/browse/FAB-678) Omit dockerfile in deployment payload
* [a7318bb](https://github.com/hyperledger/fabric-sdk-node/commit/a7318bb) Remove 2 sec pause in E2E test
* [d871138](https://github.com/hyperledger/fabric-sdk-node/commit/d871138) Fix and rename cloudant and couchdb-fabriccop-tests
* [8ac3c44](https://github.com/hyperledger/fabric-sdk-node/commit/8ac3c44) [FAB-2016](https://jira.hyperledger.org/browse/FAB-2016) Fix step logic in end-to-end.js
* [3c3e665](https://github.com/hyperledger/fabric-sdk-node/commit/3c3e665) [FAB-929](https://jira.hyperledger.org/browse/FAB-929) Implement devmode deployment support
* [22ee9c8](https://github.com/hyperledger/fabric-sdk-node/commit/22ee9c8) Fix port numbers as per the commit in fabric
* [954ea4b](https://github.com/hyperledger/fabric-sdk-node/commit/954ea4b) Tighten the supported version ranges
* [450f6da](https://github.com/hyperledger/fabric-sdk-node/commit/450f6da) Fix e2e test to run with fabric-ca docker
* [6f74833](https://github.com/hyperledger/fabric-sdk-node/commit/6f74833) nodeSDK Fixes for [FAB-1702](https://jira.hyperledger.org/browse/FAB-1702) and FAB-1704
* [3dc987f](https://github.com/hyperledger/fabric-sdk-node/commit/3dc987f) Cleanup remaining references to COP
* [90d8d42](https://github.com/hyperledger/fabric-sdk-node/commit/90d8d42) [FAB-1948](https://jira.hyperledger.org/browse/FAB-1948): Allow users to provide GOPATH from CLI
* [afc53d4](https://github.com/hyperledger/fabric-sdk-node/commit/afc53d4) Fix typos
* [27f2438](https://github.com/hyperledger/fabric-sdk-node/commit/27f2438) Fix test/fixtures/docker-compose.yaml parse error
* [3add8f6](https://github.com/hyperledger/fabric-sdk-node/commit/3add8f6) Fix test/fixtures/docker-compose.yaml parse error
* [78f630f](https://github.com/hyperledger/fabric-sdk-node/commit/78f630f) Update npm package version
* [6d2858f](https://github.com/hyperledger/fabric-sdk-node/commit/6d2858f) Add missing bn.js to fabric-ca-client/package.json
* [fd3626b](https://github.com/hyperledger/fabric-sdk-node/commit/fd3626b) [FAB-1867](https://jira.hyperledger.org/browse/FAB-1867) end-to-end based example node program
* [a33d1c5](https://github.com/hyperledger/fabric-sdk-node/commit/a33d1c5) [FAB-1239](https://jira.hyperledger.org/browse/FAB-1239) register function for fabric-ca-client
* [1f9d5e4](https://github.com/hyperledger/fabric-sdk-node/commit/1f9d5e4) Update default test_chainid to testchainid
* [caf64fe](https://github.com/hyperledger/fabric-sdk-node/commit/caf64fe) Fix build break due to accidental inclusion
* [fd85330](https://github.com/hyperledger/fabric-sdk-node/commit/fd85330) Renaming the packages to official names
* [89b118c](https://github.com/hyperledger/fabric-sdk-node/commit/89b118c) Eventhub support for v1.0
* [24926ce](https://github.com/hyperledger/fabric-sdk-node/commit/24926ce) [FAB-1835](https://jira.hyperledger.org/browse/FAB-1835) Changes return values of chaincode
* [05e1fee](https://github.com/hyperledger/fabric-sdk-node/commit/05e1fee) Enhance importKey() to support private keys
* [babccee](https://github.com/hyperledger/fabric-sdk-node/commit/babccee) [FAB-1824](https://jira.hyperledger.org/browse/FAB-1824) CouchDBKeyValueStore setValue to return value
* [2c1b874](https://github.com/hyperledger/fabric-sdk-node/commit/2c1b874) BCCSP PKCS11 implementation for node.js SDK
* [d324cb6](https://github.com/hyperledger/fabric-sdk-node/commit/d324cb6) Rename fabric-cop reference in docker-compose file
* [ea8eea9](https://github.com/hyperledger/fabric-sdk-node/commit/ea8eea9) Fix regression due to [FAB-1787](https://jira.hyperledger.org/browse/FAB-1787)
* [867e3b5](https://github.com/hyperledger/fabric-sdk-node/commit/867e3b5) Use Emacs directory-variables
* [5e2d2dd](https://github.com/hyperledger/fabric-sdk-node/commit/5e2d2dd) SDK loads pre-provisioned users - step1
* [d9fc906](https://github.com/hyperledger/fabric-sdk-node/commit/d9fc906) NodeSDK - update test cases for new chain name
* [707e9ba](https://github.com/hyperledger/fabric-sdk-node/commit/707e9ba) [FAB-837](https://jira.hyperledger.org/browse/FAB-837) Add support and test for cloudant database
* [bcddb7f](https://github.com/hyperledger/fabric-sdk-node/commit/bcddb7f) NodeSDK - chain create, submit to peers-FAB-1734
* [0b53987](https://github.com/hyperledger/fabric-sdk-node/commit/0b53987) NodeSDK - update to latest protos
* [f61aad3](https://github.com/hyperledger/fabric-sdk-node/commit/f61aad3) [FAB-1756](https://jira.hyperledger.org/browse/FAB-1756) Add support for SHA384 hash
* [7eef633](https://github.com/hyperledger/fabric-sdk-node/commit/7eef633) Add headless tests to increase coverage
* [0d7c26c](https://github.com/hyperledger/fabric-sdk-node/commit/0d7c26c) Update docker-compose file to run end-to-end tests
* [6efdd72](https://github.com/hyperledger/fabric-sdk-node/commit/6efdd72) [FAB-1713](https://jira.hyperledger.org/browse/FAB-1713) add event stream port to test fixture
* [570e4bf](https://github.com/hyperledger/fabric-sdk-node/commit/570e4bf) Remove double-counted files in istanbul config
* [cb9f8c1](https://github.com/hyperledger/fabric-sdk-node/commit/cb9f8c1) [FAB-1263](https://jira.hyperledger.org/browse/FAB-1263) ECDSA signature malleability resistance
* [1dcc5fb](https://github.com/hyperledger/fabric-sdk-node/commit/1dcc5fb) Adding CouchDB KeyValueStore Implementation
* [0df2e6b](https://github.com/hyperledger/fabric-sdk-node/commit/0df2e6b) NodeSDK - updates for latest proto files
* [2f3d29e](https://github.com/hyperledger/fabric-sdk-node/commit/2f3d29e) NodeSDK chain create submit to orderer [FAB-1531](https://jira.hyperledger.org/browse/FAB-1531)
* [2c14385](https://github.com/hyperledger/fabric-sdk-node/commit/2c14385) Add eslint rules to enforce line length
* [7a2e5a4](https://github.com/hyperledger/fabric-sdk-node/commit/7a2e5a4) Fix incorrect license header
* [9cbb41e](https://github.com/hyperledger/fabric-sdk-node/commit/9cbb41e) Added missing CONTRIBUTING and MAINTAINERS files
* [34871dd](https://github.com/hyperledger/fabric-sdk-node/commit/34871dd) Added missing CONTRIBUTING and MAINTAINERS files
* [6808b0a](https://github.com/hyperledger/fabric-sdk-node/commit/6808b0a) Update enroll function for hfc-cop
* [6524a08](https://github.com/hyperledger/fabric-sdk-node/commit/6524a08) [FAB-1520](https://jira.hyperledger.org/browse/FAB-1520)Add duplicate check to SDK addPeer function
* [05dbba4](https://github.com/hyperledger/fabric-sdk-node/commit/05dbba4) [FAB-1522](https://jira.hyperledger.org/browse/FAB-1522) Start using the new SigningIdentity
* [00ede37](https://github.com/hyperledger/fabric-sdk-node/commit/00ede37) [FAB-1221](https://jira.hyperledger.org/browse/FAB-1221) Implement SigningIdentity
* [e6a2572](https://github.com/hyperledger/fabric-sdk-node/commit/e6a2572) Cleaning up old decrypt code
* [fbb3ae3](https://github.com/hyperledger/fabric-sdk-node/commit/fbb3ae3) [FAB-1517](https://jira.hyperledger.org/browse/FAB-1517) Add shake hash 256 to hash.js
* [3f67029](https://github.com/hyperledger/fabric-sdk-node/commit/3f67029) Fix error messages in orderer-chain-tests.js
* [5786857](https://github.com/hyperledger/fabric-sdk-node/commit/5786857) [FAB-1486](https://jira.hyperledger.org/browse/FAB-1486) Avoid duplicated transaction in e2e
* [662135e](https://github.com/hyperledger/fabric-sdk-node/commit/662135e) Fix docker-compose.yml for Test
* [129ca3c](https://github.com/hyperledger/fabric-sdk-node/commit/129ca3c) Fix unresolved variable and remove comma
* [17635eb](https://github.com/hyperledger/fabric-sdk-node/commit/17635eb) [FAB-1453](https://jira.hyperledger.org/browse/FAB-1453) Use Identity class in User.js
* [669acce](https://github.com/hyperledger/fabric-sdk-node/commit/669acce) [FAB-1421](https://jira.hyperledger.org/browse/FAB-1421) Implement Identity and MSP classes
* [9c3e33f](https://github.com/hyperledger/fabric-sdk-node/commit/9c3e33f) [FAB-1408](https://jira.hyperledger.org/browse/FAB-1408) enhance ecdsa/key.js for public key
* [3163575](https://github.com/hyperledger/fabric-sdk-node/commit/3163575) [FAB-1417](https://jira.hyperledger.org/browse/FAB-1417) Move peers from request.targets to Chain
* [04a9d05](https://github.com/hyperledger/fabric-sdk-node/commit/04a9d05) [FAB-985](https://jira.hyperledger.org/browse/FAB-985) Implement official SDK API design
* [fecedd7](https://github.com/hyperledger/fabric-sdk-node/commit/fecedd7) Delete duplicate check in _checkProposalRequest
* [b490e12](https://github.com/hyperledger/fabric-sdk-node/commit/b490e12) Add istanbul config file
* [bc2c406](https://github.com/hyperledger/fabric-sdk-node/commit/bc2c406) Updated README.md to be more accurate
* [12cd5de](https://github.com/hyperledger/fabric-sdk-node/commit/12cd5de) [FAB-1264](https://jira.hyperledger.org/browse/FAB-1264) allow e2e test to run each step
* [1949d11](https://github.com/hyperledger/fabric-sdk-node/commit/1949d11) NodeSDK - updates to protos
* [f3caf77](https://github.com/hyperledger/fabric-sdk-node/commit/f3caf77) [FAB-1272](https://jira.hyperledger.org/browse/FAB-1272) enhance marbles.js with steps
* [a1698aa](https://github.com/hyperledger/fabric-sdk-node/commit/a1698aa) NodeSDK updates for new protobufs
* [b26c06e](https://github.com/hyperledger/fabric-sdk-node/commit/b26c06e) Fix cert and csr test fixtures
* [edb5b12](https://github.com/hyperledger/fabric-sdk-node/commit/edb5b12) [FAB-1032](https://jira.hyperledger.org/browse/FAB-1032) fix "possible memory leak" warning
* [004ef32](https://github.com/hyperledger/fabric-sdk-node/commit/004ef32) [FAB-1245](https://jira.hyperledger.org/browse/FAB-1245) Move COP client tests to headless-tests
* [2a6987f](https://github.com/hyperledger/fabric-sdk-node/commit/2a6987f) [FAB-1235](https://jira.hyperledger.org/browse/FAB-1235) add setEnrollment() to Member
* [1f08e84](https://github.com/hyperledger/fabric-sdk-node/commit/1f08e84) [FAB-1084](https://jira.hyperledger.org/browse/FAB-1084) Move MemberServices out of HFC
* [68d7280](https://github.com/hyperledger/fabric-sdk-node/commit/68d7280) [FAB-1220](https://jira.hyperledger.org/browse/FAB-1220) update ecert persistence to PEM
* [d60dc6f](https://github.com/hyperledger/fabric-sdk-node/commit/d60dc6f) [FAB-1208](https://jira.hyperledger.org/browse/FAB-1208) update e2e test's creds for COP
* [c66a956](https://github.com/hyperledger/fabric-sdk-node/commit/c66a956) [FAB-1186](https://jira.hyperledger.org/browse/FAB-1186) add query at the end of marbles test
* [a7f57ba](https://github.com/hyperledger/fabric-sdk-node/commit/a7f57ba) [FAB-1182](https://jira.hyperledger.org/browse/FAB-1182) change SDK tests to use SHA256
* [3ebadb7](https://github.com/hyperledger/fabric-sdk-node/commit/3ebadb7) Fix minor bug in standlone COP test
* [223d769](https://github.com/hyperledger/fabric-sdk-node/commit/223d769) [FAB-1107](https://jira.hyperledger.org/browse/FAB-1107) Implement enroll function to work with COP
* [4672efe](https://github.com/hyperledger/fabric-sdk-node/commit/4672efe) Add CSR generation function to the ECDSA key class
* [ebfd858](https://github.com/hyperledger/fabric-sdk-node/commit/ebfd858) NodeSDK - Sign the Proposal and include cert
* [bb46f2c](https://github.com/hyperledger/fabric-sdk-node/commit/bb46f2c) [FAB-1148](https://jira.hyperledger.org/browse/FAB-1148) end-to-end test needs key size 256
* [1ed20f2](https://github.com/hyperledger/fabric-sdk-node/commit/1ed20f2) [FAB-1143](https://jira.hyperledger.org/browse/FAB-1143) endorser-tests.js bug in error responses
* [3df017d](https://github.com/hyperledger/fabric-sdk-node/commit/3df017d) [FAB-1108](https://jira.hyperledger.org/browse/FAB-1108) Initial impl of BCCSP
* [bcaaf24](https://github.com/hyperledger/fabric-sdk-node/commit/bcaaf24) [FAB-1051](https://jira.hyperledger.org/browse/FAB-1051) Node SDK to the latest protobuf defs
* [1c79e47](https://github.com/hyperledger/fabric-sdk-node/commit/1c79e47) [FAB-121](https://jira.hyperledger.org/browse/FAB-121) Support concurrent endorsement proposals
* [5222a00](https://github.com/hyperledger/fabric-sdk-node/commit/5222a00) NodeSDK deploy chain code with user name [FAB-1052](https://jira.hyperledger.org/browse/FAB-1052)
* [cabab55](https://github.com/hyperledger/fabric-sdk-node/commit/cabab55) NodeSDK prepare for multiple endorsing peers
* [013c1a2](https://github.com/hyperledger/fabric-sdk-node/commit/013c1a2) [FAB-1053](https://jira.hyperledger.org/browse/FAB-1053) remove generateNounce() from CryptoSuite API
* [74aaa9a](https://github.com/hyperledger/fabric-sdk-node/commit/74aaa9a) NodeSDK convert to new protos and add invoke and query
* [cf80346](https://github.com/hyperledger/fabric-sdk-node/commit/cf80346) [FAB-952](https://jira.hyperledger.org/browse/FAB-952) end-to-end test fails in a clean environment
* [4498b18](https://github.com/hyperledger/fabric-sdk-node/commit/4498b18) [FAB-950](https://jira.hyperledger.org/browse/FAB-950) self-contained chaincode deploy test setup
* [5bfcc6f](https://github.com/hyperledger/fabric-sdk-node/commit/5bfcc6f) Delete unused stats.js
* [eb8eeac](https://github.com/hyperledger/fabric-sdk-node/commit/eb8eeac) [FAB-938](https://jira.hyperledger.org/browse/FAB-938) Catch up e2e test to latest Peer protobuf
* [3ca4e6f](https://github.com/hyperledger/fabric-sdk-node/commit/3ca4e6f) [FAB-932](https://jira.hyperledger.org/browse/FAB-932) Gulp task to run tests with coverage reports
* [2e440f0](https://github.com/hyperledger/fabric-sdk-node/commit/2e440f0) [FAB-927](https://jira.hyperledger.org/browse/FAB-927) Updated README with docker-compose content
* [e0b4a69](https://github.com/hyperledger/fabric-sdk-node/commit/e0b4a69) [FAB-925](https://jira.hyperledger.org/browse/FAB-925) Use flat-chaining on Promise-based calls
* [20e8c7e](https://github.com/hyperledger/fabric-sdk-node/commit/20e8c7e) add npm test to gulp tasks
* [388af46](https://github.com/hyperledger/fabric-sdk-node/commit/388af46) [FAB-49](https://jira.hyperledger.org/browse/FAB-49) update endorser API to latest protobuf
* [171d374](https://github.com/hyperledger/fabric-sdk-node/commit/171d374) [FAB-926](https://jira.hyperledger.org/browse/FAB-926) Fixed headless-tests.js being stuck in Promise
* [83313c1](https://github.com/hyperledger/fabric-sdk-node/commit/83313c1) Fix end() called twice in headless-tests.js
* [32bb193](https://github.com/hyperledger/fabric-sdk-node/commit/32bb193) Add build and documentation badge in README
* [2b8b1a0](https://github.com/hyperledger/fabric-sdk-node/commit/2b8b1a0) minor README changes
* [74c09cf](https://github.com/hyperledger/fabric-sdk-node/commit/74c09cf) Add readthedocs doc files to fabric-sdk-node
* [21473c4](https://github.com/hyperledger/fabric-sdk-node/commit/21473c4) Added "happy path end-to-end test"
* [9731107](https://github.com/hyperledger/fabric-sdk-node/commit/9731107) NodeSDK add hierarchical configuration support [FAB-741](https://jira.hyperledger.org/browse/FAB-741)
* [7ba3992](https://github.com/hyperledger/fabric-sdk-node/commit/7ba3992) Fixed sendDeploymentProposal() promise chaining issue
* [0dbf4a7](https://github.com/hyperledger/fabric-sdk-node/commit/0dbf4a7) Enforce supported versions of node and npm
* [57bf3a1](https://github.com/hyperledger/fabric-sdk-node/commit/57bf3a1) Update fabric-sdk-node with changes from master
* [38c9517](https://github.com/hyperledger/fabric-sdk-node/commit/38c9517) Updated .gitignore to exclude "coverage" and "tmp"
* [cca09d6](https://github.com/hyperledger/fabric-sdk-node/commit/cca09d6) Updated README to include more contributor information
* [33f7b34](https://github.com/hyperledger/fabric-sdk-node/commit/33f7b34) Initial implementation for logging utility
* [9203fbb](https://github.com/hyperledger/fabric-sdk-node/commit/9203fbb) Add trailing spaces check to gulp lint
* [fb38844](https://github.com/hyperledger/fabric-sdk-node/commit/fb38844) Add CryptoSuite_ECDSA_SHA unit tests to headless-tests
* [dbcdb46](https://github.com/hyperledger/fabric-sdk-node/commit/dbcdb46) Adding Member Wrapper For Orderer
* [e5d06ea](https://github.com/hyperledger/fabric-sdk-node/commit/e5d06ea) Adding Orderer Class
* [25cbf0e](https://github.com/hyperledger/fabric-sdk-node/commit/25cbf0e) Initial implementation for sending endorser proposal
* [e127d5b](https://github.com/hyperledger/fabric-sdk-node/commit/e127d5b) Add tests to headless-tests.js
* [c5dd336](https://github.com/hyperledger/fabric-sdk-node/commit/c5dd336) Clean up the API
* [c0ea692](https://github.com/hyperledger/fabric-sdk-node/commit/c0ea692) Add gulp eslint task for common coding styles
* [869da76](https://github.com/hyperledger/fabric-sdk-node/commit/869da76) Changed to use ES6 class construct
* [0b2d441](https://github.com/hyperledger/fabric-sdk-node/commit/0b2d441) Refactored crypto-related APIs to be algorithm-agnostic
* [4d9b475](https://github.com/hyperledger/fabric-sdk-node/commit/4d9b475) Initial implementation


<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
s
