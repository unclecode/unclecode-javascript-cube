const shell = require("shelljs")

const fetchLesson = async (repo, branch) => {
	console.log("Fetch student lesson branch...")
	const _silent = false;
    const studentRepoName = repo.split('/')[1];
	const studentUsername = studentRepoName.split('-')[0];
	// fetch branch into branch-test
	await shell.exec(`git fetch https://github.com/${studentUsername}/${studentRepoName}.git ${branch}:${branch}-test`, { silent: _silent, async: true});
	return true;
}

//fetchLesson(process.argv[2], process.argv[3]).then((res) => {
//    console.log(res)
//})
