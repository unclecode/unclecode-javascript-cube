const path = require('path')
const fs = require('fs')
const chalk = require('chalk');

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
			total: runResults.numTotalTests,
			failed: runResults.numFailedTests,
			passed: runResults.numPassedTests,
			startTime: runResults.startTime,
			duration: +new Date() - runResults.startTime,
			endTime: +new Date(),
			suites: runResults.testResults.map(s => ({
				describe: s.testResults[0].ancestorTitles.join(" "),
				file: s.testFilePath.split('/')[s.testFilePath.split('/').length - 1],
				test: s.testResults.map(t => ({
					fullName: t.fullName,
					title: t.title,
					status: t.status === "passed"
				})),
				total: s.testResults.length,
				passed: s.testResults.filter(t => t.status === "passed").length,
				failed: s.testResults.filter(t => t.status !== "passed").length,
				status: s.testResults.length === s.testResults.filter(t => t.status === "passed").length
			}))
		}

		fs.writeFileSync(process.cwd() + "/__tests__/result.json", JSON.stringify(result, null, 4))

		result.suites.forEach(s => {
			let testLog = s.test.map(t => chalk.bold(`${t.status ? chalk.green('Passed') : chalk.red('Failed')}: ${chalk.white(t.fullName)}`)).join("\n\r");
			let txt = chalk.bold(`\n${chalk.bold.cyan(s.describe)}\nTotal: ${s.total} ${chalk.green('Passed:')} ${chalk.green(s.passed)} ${chalk.red('Failed:')} ${chalk.red(s.failed)}\n${testLog}`);
			console.log(txt)
		});

		// console.dir(result, {depth: null, colors: true})

	}
}

module.exports = MyReporter;