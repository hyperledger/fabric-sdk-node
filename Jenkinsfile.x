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
     env.NODE_VER = "8.9.4"
     env.GO_VER = "1.10"
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

// Archive Build artifacts (logs)
      stage("Archive Build artifacts") {
          archiveArtifacts artifacts: '**/*.log'
      }
     } finally {
           junit '**/cobertura-coverage.xml'
           step([$class: 'CoberturaPublisher', autoUpdateHealth: false, autoUpdateStability: false, coberturaReportFile: '**/cobertura-coverage.xml', failUnhealthy: false, failUnstable: false, maxNumberOfBuilds: 0, onlyStable: false, sourceEncoding: 'ASCII', zoomCoverageChart: false])
           // Sends notification to Rocket.Chat
           rocketSend channel: 'jenkins-robot', message: "Build Notification - Branch: ${env.GERRIT_BRANCH} - Project: ${env.PROJECT} - Commit: ${env.GERRIT_PATCHSET_REVISION}- (<${env.BUILD_URL}|Open>)"
       }
}

def unstableNpm() {
// Publish unstable npm modules after successful merge
      stage("Publish Unstable npm modules") {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-sdk-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --publish_Unstable'
                 }
               }
           catch (err) {
                 failure_stage = "publish_Unstable"
                 throw err
           }
      }
}

def apiDocs() {
// Publish SDK_NODE API docs after successful merge
      stage("Publish API Docs") {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-sdk-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --publish_Api_Docs'
                 }
               }
           catch (err) {
                 failure_stage = "publish_Api_Docs"
                 throw err
           }
      }
}
