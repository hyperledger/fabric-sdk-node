# Cucumber Test Scenarios For Fabric-SDK-Node

This test suite is intended to provide high level test coverage from a scenario perspective, and tests herein represent those at the top of the test pyramid. Consequently, these test should be added to with due consideration and should encapsulate the completion of a high level user task; for more fine grained testing, the FV or unit test frameworks should be used.

The test suite uses the docker network and crypto files from within `/test/ts-fixtures`. If crypto material does not exist, which is the case if you have recently cloned the repository, it is necessary to run the `installAndGenerateCerts` or `installAndGenerateCertsMac` npm task prior to running the tests.

## Structure

The folder structure is the following:

```
ts-fixtures
└───chaincode
└───cryptomaterial
│    └───config-base
│    └───config-update
└───docker-compose

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
└───steps
│    └───lib
│	   file.ts
│    mapping-step-file.ts
│
└───support
     support-files.ts

```

- The scenario test resources are contained within the `ts-fixture` directory
  - `chaincode` contains deployable smart contracts under `goLang`, `java`, and `node` folders. 
  - `cryptomaterial config-base` contains the channel creation files **add to these to get new channels for new feature files**
  - `cryptomaterial config-update` contains the channel update files
  - `docker-compose` contains the network files to test against

- The scenario tests and all required test files are contained within the `ts-scenario` directory
  - `config` contains connection profiles, and a json document of all possible endorsement policies
  - All feature files are contained in the `features` directory
    - `*.feature` the self contained feature file that describes a set of feature scenarios that decompose into programmatic steps contained in the `steps` folder
  - `steps` contains all the step files required by the feature files that exist in the sibling `features` directory. The highest level of the `steps` directory is reserved for the natural language mapping from the feature, to the underlying code. Any files called by these high level mapping, reside within the `steps/lib` directory.
  - `support` contains a `hooks.js` file that is used to provide before/after hooks.


## Running the Tests
To run the tests, issue the command `npm run test:ts-cucumber`, which will run all feature files located within `/test/ts-scenario/features`.

It is possible to run a single feature file by using the command `npm run test:ts-cucumber-tagged`. It is important to modify the `package.json` file to make sure the correct tag is being run if you want to do this.

## Contributing Tests

### Cucumber 101
Cucumber tests are divided into features, which are subdivided into Scenarios, which are a sequence of steps, to support behavior driven development. 
- Feature: a use case that describes a specific function of the software being tested
- Scenario: a flow of events through the Feature being described and maps 1:1 with an executable test case for the system
- Steps: outline the preconditions and flow of events that will take place. The first word of a step is a keyword, typically one of:
  - Given - Describes the preconditions and initial state before the start of a test and allows for any pre-test setup that may occur
  - When - Describes actions taken by a user during a test
  - Then - Describes the outcome resulting from actions taken in the When clause

Occasionally, the combination of Given-When-Then uses other keywords to define conjunctions
  - And - Logical and
  - But - Logically the same as And, but used in the negative form

Tags are `@`-prefixed strings and can be placed before:
- Feature
- Scenario
- Scenario Outline
- Examples

They are used to enable isolated running of features or scenarios.

A typical feature file would resemble:

	@my-feature
	- Feature (high level outline of a single feature)
		-- Scenario 1 (scenario relevant to the feature)
			-- Given [preconditions]
			-- When [actions]
			-- Then [results]
		-- Scenario 2 (another scenario relevant to the feature)
			...

Hooks are used to enable tasks to be run before and after the running of features, and are useful for ensuring complete teardown of the test process. This is important if part of the test process is blocking , since it will prevent the termination of the test process.

For more information, feel free to check out the wealth of literature online.

### TS-Cucumber Rules

The following are hard and fast rule for adding cucumber tests:
- Each feature has it's own tag
- Each feature must be capable of running in isolation, and as part of the complete test suite. They **must not** rely on output from any other feature file that may exist in the test suite.
- Each feature must be isolated. This has been deliberately written twice, because it is important!
- Each feature must operate on its own channel. This is not just for test isolation, but provides the ability to run features in parallel.
- Cucumber syntax rules must be adhered to, with each scenario being understandable at a management level through reading the scenario text. 
- All steps are written in Typescript
- Reuse existing steps. Through maintaining the abstractions enforced by Cucumber, it should minimize the need to add additional steps.

### TS-Cucumber Layout

The folder structure has already been outlined, however, it is expected that:
- All feature files live in the `features` directory
- The natural language mapping from the features to the steps is in the top level `steps` folder
- All support code for the steps within the hight level `steps` folder, is within the `steps/lib` folder

The purpose of the above structure is to help navigate the test code.

## FAQ

What docker network do the tests run on?
> The cucumber tests run on the `docker-compose_default` docker network, which is created by `docker_steps.js` when using the network definition files defined in `/docker-compose`
