const path = require('path')
const fs = require('fs')
class MyReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;
  }
  onRunStart(runResults, runConfig) {
    //console.log(`😍onRunStart arguments: ${JSON.stringify(arguments)}`);
  }

  onTestResult(testRunConfig, testResults, runResults) {
    //console.log(`😍onTestResult arguments: ${JSON.stringify(arguments)}`);
  }

  onRunComplete(test, runResults) {
    let result = {
      status: runResults.numTotalTests === runResults.numPassedTests,
      total : runResults.numTotalTests,
      failed: runResults.numFailedTests,
      passed: runResults.numPassedTests,
      startTime: runResults.startTime,
      duration: +new Date() - runResults.startTime,
      endTime: +new Date(),
      suites:runResults.testResults.map(s=>({
        describe : s.testResults[0].ancestorTitles.join(" "),
        file: s.testFilePath.split('/')[s.testFilePath.split('/').length - 1],
        test: s.testResults.map(t => ({
          fullName  : t.fullName,
          title : t.title,
          status: t.status === "passed"
        })),
        total: s.testResults.length,
        passed: s.testResults.filter(t=>t.status === "passed").length,
        failed: s.testResults.filter(t=> t.status !== "passed").length,
        status: s.testResults.length === s.testResults.filter(t=>t.status === "passed").length
      }))
    }

    fs.writeFileSync( process.cwd() + "/__tests__/result.json", JSON.stringify(result, null, 4))

    //console.dir(result, {depth: null, colors: true})

  }
}

module.exports = MyReporter;
