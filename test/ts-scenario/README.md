# Cucumber Test Scenarios For Fabric-SDK-Node

Welcome to the Fabric-SDK-Node Cucumber test readme. Below are some notes on these tests, but before you go any further, here are some general contribution guide lines:
 - All tests re written in Typescript
 - Each feature file should have its own tag
 - All features and scenarios must be isolated from one another (no relying on other tests to create things for you!)
   - Each feature must be runnable in isolation
   - Each scenario must be runnable in isolation
- Full suite should complete in the presence of failures; it is important that the suite completes on all eventualities and not hang if a test fails. For instance, this can occur if a process is not terminated.
- Tags are used to specify which features are to be run for target builds

This test suite is intended to provide high level test coverage from a scenario perspective, and tests herein represent those at the top of the test pyramid. Consequently, these test should be added to with due consideration and should encapsulate the completion of a high level user task; for more fine grained testing, the FV or unit test frameworks should be used.

The test suite uses the docker network and crypto files from within `/test/ts-fixtures`. If crypto material does not exist, which is the case if you have recently cloned the repository, it is necessary to run the `install-and-generate-certs` gulp task prior to running the tests.

## Structure

The folder structure is the following:

```
ts-scenario
│   README.md
│   tsconfig.json 
│   
└───config
│    profile.json
│    policies.json
│
└───features
│    feature_file.feature 
│   
│ 
└───steps
│    step-files.js
└───support
     support-files.js

```

- The scenario tests and all required test files are contained within the `ts-scenario` directory
- `config` contains connection profiles, and a json document of all possible endorsement policies
- All feature files and supporting files are contained in the `features` directory
  - `*.feature` the self contained feature file that describes a set of feature scenarios that decompose into programmatic steps
- `steps` contains all the step files required by the feature files that exist in the parent directory.
- `support` contains two framework files: the main `index.js` file called by the cucumber test runner, and a `hooks.js` file that is used to provide tag based before/after hooks.


## Running the Tests

The tests are run at a high level within the `/build` directory using the main `test.js` gulp file, or the npm script:
- To run the test using gulp, issue the command `gulp run-test:ts-cucumber`. 
- To run the test using npm script, issue the command `npm run test:ts-cucumber`. 
Both commands will run all feature files located within `/test/ts-scenario/features`.


## FAQ

What docker network do the tests run on?
> The cucumber tests run on the `cucumber_default` docker network, which is created by `docker_steps.js` when using the network definition files defined in `/docker-compose`
