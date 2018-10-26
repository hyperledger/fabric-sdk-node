// Copyright IBM Corp All Rights Reserved
//
// SPDX-License-Identifier: Apache-2.0
//
node ('hyp-x') { // trigger build on x86_64 node
  timestamps {
    try {
     def ROOTDIR = pwd() // workspace dir (/w/workspace/<job_name>
     env.PROJECT_DIR = "gopath/src/github.com/hyperledger"
     env.GOPATH = "$WORKSPACE/gopath"
     env.NODE_VER = "8.11.3"
     env.GO_VER = "1.10.4"
     env.PATH = "$GOPATH/bin:/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin:~/npm/bin:/home/jenkins/.nvm/versions/node/v${NODE_VER}/bin:$PATH"
     env.GOROOT = "/opt/go/go${GO_VER}.linux.amd64"
     env.PATH = "$GOROOT/bin:$PATH"
     def failure_stage = "none"
// delete working directory
     deleteDir()
      stage("Fetch Patchset") { // fetch gerrit refspec on latest commit
         wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
          try {
              dir("${ROOTDIR}"){
              sh '''
                 [ -e gopath/src/github.com/hyperledger/fabric-sdk-node ] || mkdir -p $PROJECT_DIR
                 cd $PROJECT_DIR
                 git clone git://cloud.hyperledger.org/mirror/fabric-sdk-node && cd fabric-sdk-node
                 git checkout "$GERRIT_BRANCH" && git fetch origin "$GERRIT_REFSPEC" && git checkout FETCH_HEAD
              '''
              }
          }
          catch (err) {
                 failure_stage = "Fetch patchset"
                 currentBuild.result = 'FAILURE'
                 throw err
           }
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

// Run gulp tests (headless and e2e tests)
      stage("Run gulp_Tests") {
         wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-sdk-node/scripts/Jenkins_Scripts") {
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

// Publish unstable npm modules from merged job
if (env.GERRIT_EVENT_TYPE == "change-merged") {
    unstableNpm()
}  else {
     echo "------> Don't publish npm modules from verify job"
   }

// Publish API Docs from merged job only
if (env.GERRIT_EVENT_TYPE == "change-merged") {
    apiDocs()
} else {
     echo "------> Don't publish API Docs from verify job"
   }
    } finally { // Code for coverage report
           junit '**/cobertura-coverage.xml'
           step([$class: 'CoberturaPublisher', autoUpdateHealth: false, autoUpdateStability: false, coberturaReportFile: '**/cobertura-coverage.xml', failUnhealthy: false, failUnstable: false, maxNumberOfBuilds: 0, onlyStable: false, sourceEncoding: 'ASCII', zoomCoverageChart: false])
           archiveArtifacts allowEmptyArchive: true, artifacts: '**/*.log'
           if (env.GERRIT_EVENT_TYPE == 'change-merged') {
              if (currentBuild.result == 'FAILURE') { // Other values: SUCCESS, UNSTABLE
               rocketSend channel: 'jenkins-robot', message: "Build Notification - STATUS: ${currentBuild.result} - BRANCH: ${env.GERRIT_BRANCH} - PROJECT: ${env.PROJECT} - (<${env.BUILD_URL}|Open>)"
              }
           }
      } // finally block end here
   } // timestamps block end here
} // node block end here

def unstableNpm() {
def ROOTDIR = pwd()
// Publish unstable npm modules after successful merge
      stage("Publish Unstable npm modules") {
         wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-sdk-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --publish_Unstable'
                 }
               }
           catch (err) {
                 failure_stage = "publish_Unstable"
                 currentBuild.result = 'FAILURE'
                 throw err
           }
         }
      }      
}

def apiDocs() {
def ROOTDIR = pwd()
// Publish SDK_NODE API docs after successful merge
      stage("Publish API Docs") {
         wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-sdk-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --publish_Api_Docs'
                 }
               }
           catch (err) {
                 failure_stage = "publish_Api_Docs"
                 currentBuild.result = 'FAILURE'
                 throw err
           }
         }
      }
}
