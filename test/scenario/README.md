# Cucumber Test Sceanrios For Fabric-SDK-Node

Welcome to the Fabric-SDK-Node Cucmber test readme. Below are some notes on these tests, but before you go any further, here are some general contribution guide lines:
 - Each feature file must have its own tag
 - All features and scenarios must be isolated from one another (no relying on other tests to create things for you!)
   - Each feature must be runnable in isolation
   - Each scenario must be runnable in isolation
- Full suite should complete in the presence of failures; it is important that the suite completes on all eventualities and not hang if a test fails. For instance, this can occur if a process is not terminated.
- When adding new step files, these must be included within `/steps/index.js` so that they are discoverable by the feature file(s)
- Tags are used to run Before/After functions for specific scenarios. For examples of this, refer to the `network_api.feature` that requires a clean up process to run in the event of a test failure.

This test suite is intended to provide high level test coverage from a scenario perspective, and tests herein represent those at the top of the test pyramid. Consequently, these test should be added to with due consideration and should encapsulate the completion of a high level user task; for more fine grained testing, the FV or unit test frameworks should be used.

## Structure

The folder structure is the following:

```
scenario
│   README.md
│
└───chaincode
│   │
│   └───cc1
│       │
│       └───go
│       └───node
│   
└───config
│   │   profile.json
│   │   policies.json
│   └───crypto-config
│  
└───docker-compose
│       compose-files.yaml
│
└───features
    │   feature_file.feature 
    │   
    └───lib
    │       helper-files.js
    └───steps
    │       step-files.js
    └───support
            support-files.js

```

- The scenario tests and all required files are conatained within the `scenario` directory
- `chaincode` holds all the chaincode files used within the cucmber tesst, with each chaincode contained within a specific named folder, itself decomposed into goLang and node. The structure here is important, since step files rely on the consistent location and naming strategy to deploy named chaincode of a specific type.
- `config` contains connection profiles, a json document of all possible endorsement policies, and a crypto-config directory that contains the crypto-material for the network defined within the docker-compose folder.
- `docker-compose` contains the two test networks, tls and non-tls, that are used within the cucumber tests.
- All feature files and supporting files are contained in the `features` directory
  - `*.feature` the self contained feature file that describes a set of feature scenarios that decompose into programatic steps
  - `lib` contains helper files used by step files.
  - `steps` contains all the step files required by the feature files that exist in the parent directory.
  - `support` contains two framework files: the main `index.js` file called by the cucumber test runner, and a `hooks.js` file that is used to provide tag based before/after hooks.


## Running the Tests

The tests are run at a high level within the `/build` directory using the main `test.js` gulp file, or the npm script:
- To run the test using gulp, issue the command `gulp run-test-cucumber`. 
- To run the test using npm script, issue the command `npm run test:cucumber`. 
Both commands will run all feature files located within `/test/scenario/features`.


## FAQ

What docker network do the tests run on?
> The cucumber tests run on the `cucumber_default` docker network, which is created by `docker_steps.js` when using the network definition files defined in `/docker-compose`
