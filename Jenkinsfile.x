// Copyright IBM Corp All Rights Reserved
//
// SPDX-License-Identifier: Apache-2.0
//
timeout(40) {
node ('hyp-x') { // trigger build on x86_64 node
  timestamps {
    try {
     def ROOTDIR = pwd() // workspace dir (/w/workspace/<job_name>)
     env.PROJECT_DIR = "gopath/src/github.com/hyperledger"
     env.GOPATH = "$WORKSPACE/gopath"
     env.ARCH = "amd64"
     def nodeHome = tool 'nodejs-8.11.3'
     env.PATH = "$GOPATH/bin:/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin:${nodeHome}/bin:$PATH"
     def failure_stage = "none"
// delete working directory
     deleteDir()
      stage("Fetch Patchset") { // fetch gerrit refspec on latest commit
          try {
              dir("${ROOTDIR}") {
              sh '''
                 [ -e gopath/src/github.com/hyperledger/fabric-sdk-node ] || mkdir -p $PROJECT_DIR
                 cd $PROJECT_DIR
                 # Clone fabric-sdk-node repository
                 git clone git://cloud.hyperledger.org/mirror/fabric-sdk-node && cd fabric-sdk-node
                 # Checkout to Branch and Apply patchset on latest commit
                 git checkout "$GERRIT_BRANCH" && git fetch origin "$GERRIT_REFSPEC" && git checkout FETCH_HEAD
                 # Print last commit details
                 git log -n2 --pretty=oneline --abbrev-commit
              '''
              }
          }
          catch (err) {
                 failure_stage = "Fetch patchset"
                 currentBuild.result = 'FAILURE'
                 throw err
           }
         }
// clean environment and get env data
      stage("Clean Environment - Get Env Info") {
         wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-sdk-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --clean_Environment --env_Info'
                 }
               }
           catch (err) {
                 failure_stage = "Clean Environment - Get Env Info"
                 currentBuild.result = 'FAILURE'
                 throw err
           }
         }
         }

// Run gulp tests (headless and Integration tests)
      stage("Run Headless & Integration Tests") {
         wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-sdk-node/scripts/Jenkins_Scripts") {
                 // Get the testFabricVersion and thirdpartyVersion from package.json
                 // and Pull the DockerImages from dockerhub and run the Integration Tests
                 sh './CI_Script.sh --sdk_E2e_Tests'
                 }
               }
           catch (err) {
                 failure_stage = "sdk_E2e_Tests"
                 currentBuild.result = 'FAILURE'
                 throw err
           }
         }
      }

// Publish npm modules from merge job
if (env.JOB_NAME == "fabric-sdk-node-merge-x86_64") {
    publishNpm()
}  else {
     echo "------> Don't publish npm modules from VERIFY job"
   }

// Publish API Docs from merged job only
if (env.JOB_NAME == "fabric-sdk-node-merge-x86_64") {
    apiDocs()
} else {
     echo "------> Don't publish API Docs from VERIFY job"
   }
    } finally { // Code for coverage report
           step([$class: 'CoberturaPublisher', autoUpdateHealth: false, autoUpdateStability: false, coberturaReportFile: '**/cobertura-coverage.xml', failUnhealthy: false, failUnstable: false, failNoReports: false, maxNumberOfBuilds: 0, onlyStable: false, sourceEncoding: 'ASCII', zoomCoverageChart: false])
           archiveArtifacts allowEmptyArchive: true, artifacts: '**/*.log'
           if (env.JOB_NAME == "fabric-sdk-node-merge-x86_64") {
              if (currentBuild.result == 'FAILURE') { // Other values: SUCCESS, UNSTABLE
               rocketSend message: "Build Notification - STATUS: *${currentBuild.result}* - BRANCH: *${env.GERRIT_BRANCH}* - PROJECT: *${env.PROJECT}* - BUILD_URL - (<${env.BUILD_URL}|Open>)"
              }
           }
      } // finally block end here
   } // timestamps block end here
} // node block end here
} // time block end here

def publishNpm() {
// Publish npm modules after successful merge
      stage("Publish npm Modules") {
        def ROOTDIR = pwd()
        withCredentials([[$class       : 'StringBinding',
                      credentialsId: 'NPM_LOCAL',
                      variable : 'NPM_TOKEN']]) {
        wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-sdk-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --publish_NpmModules'
                 }
               }
           catch (err) {
                 failure_stage = "publish_NpmModules"
                 currentBuild.result = 'FAILURE'
                 throw err
           }
        }
        }
      }
}

def apiDocs() {
// Publish SDK_NODE API docs after successful merge
      stage("Publish API Docs") {
        def ROOTDIR = pwd()
        withCredentials([[$class     : 'UsernamePasswordMultiBinding',
                         credentialsId: 'sdk-node-credentials',
                         usernameVariable: 'NODE_SDK_USERNAME',
                         passwordVariable: 'NODE_SDK_PASSWORD']]) {
        wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-sdk-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --publish_ApiDocs'
                 }
               }
           catch (err) {
                 failure_stage = "publish_ApiDocs"
                 currentBuild.result = 'FAILURE'
                 throw err
           }
        }
        }
      }
}
