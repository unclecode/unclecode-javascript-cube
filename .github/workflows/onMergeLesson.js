const fs = require('fs');
const shell = require("shelljs")
const axios = require("axios");
const Octokit = require("@octokit/rest");


async function fetchLesson() {
    console.log("Getting lessons...");
    try {
        shell.exec(`git checkout master`, {silent: false});
        let lessons = (fs.readFileSync(`lessons.index`, 'utf8')).split("\n").filter(Boolean)
        return lessons
    } catch (err) {
        throw err
    }
}

function isEqual(arr1, arr2) {
    if (arr1.length !== arr2.length)
        return false;
    for (let i = arr1.length; i--;) {
        if (arr1[i] !== arr2[i])
            return false;
    }
    return true;
}

async function checkAllBranchesDone(owner, repo, lessons, token){
    let octokit = new Octokit({
        auth: "token " + token
    });
    let branches = (await octokit.repos.listBranches({
        owner,
        repo
    })).data;
    branches = branches.filter(b => !b.name.endsWith('master')).map(b => b.name);
    console.log(branches)
    return isEqual(lessons, branches)
}

async function checkIsDone(cHub, repo, gitToken, branch, isMerged) {
    if (isMerged) {
        console.log("Checking merge request...");

        const KIDOCODE = 'kportal-hub';
        const server = "https://cubie.now.sh";

        try {
            const studentRepoName = repo.split('/')[1];
            const studentUsername = studentRepoName.split('-')[0];
            const cubeName = studentRepoName.split('-')[1];
            const qHubCube = `${cubeName}-qhub-test`;

            let lessons = await fetchLesson();
            let isDone = await checkAllBranchesDone(cHub, studentRepoName, lessons, gitToken);
            if (isDone) {
                // then notify trainer
                axios.post(server + "/api/notify", {
                    "username": studentUsername,
                    "repoLink": `https://github.com/${repo}`,
                    "receiver": "nasrin@kidocode.com"
                })
            }
            else {
                console.log("Cube is not completed!")
            }

        } catch (err) {
            console.log(err)
            throw err
        }
    }
}

const onMergeLesson = async (repo, gitToken, isMerged, branch) => {
    const cHub = "kportal-hub";
    return await checkIsDone(cHub, repo, gitToken, branch, isMerged)
}

onMergeLesson(process.argv[2], process.argv[3], process.argv[5], process.argv[4]).then((res) => {
    console.log(res)
})
