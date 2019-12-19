const crypto = require('crypto');
const shell = require("shelljs")
const axios = require("axios");
const Octokit = require("@octokit/rest");

async function encryptAndPutAuthFile(username, repo, algorithm, gitToken, authPhrase, _silent) {
    try {
        var cipher = crypto.createCipher(algorithm, gitToken);
        var encryptedPhrase = cipher.update(authPhrase, 'utf8', 'hex');
        encryptedPhrase += cipher.final('hex');
        shell.exec(`git checkout master`, {silent: _silent});
        shell.exec(`echo ${encryptedPhrase} > auth`, {silent: _silent});
        shell.exec(`git add auth`, {silent: _silent});
        shell.exec(`git commit -m 'add auth file'`, {silent: _silent});
        shell.exec(`git push https://${username}:${gitToken}@github.com/${repo} master`, {silent: _silent});
        return true
    } catch (err) {
        throw err
    }
}

async function getUserTokenAndDecrypt(repo, algorithm, pwd) {
    try {
        let resp = await axios.get(`https://api.github.com/repos/${repo}/contents/auth`);
        let content = Buffer.from(resp.data.content, 'base64').toString('ascii').replace(/\n/g, "");
        var decipher = crypto.createDecipher(algorithm, pwd);
        var token = decipher.update(content, 'hex', 'utf8');
        token += decipher.final('utf8');
        return token;
    } catch (err) {
        throw err
    }
}

async function fetchLesson(kidocode, qHubCube, token, index) {
    console.log("Getting first lesson name...");
    try {
        let octokit = new Octokit({
            auth: "token " + token
        });
        let resp = await octokit.repos.getContents({
            owner: kidocode,
            repo: qHubCube,
            path: `lessons.index`, // `cube.json`
            headers: {
                'accept': 'application/vnd.github.VERSION.raw'
            }
        });

        return resp.data.split("\n").filter(Boolean)[index] // JSON.parse(resp.data)['index'][index]
    } catch (err) {
        throw err
    }
}

async function deleteFile(owner, repo, path, message, sha, branch, token) {
    try {
        let octokit = new Octokit({
            auth: "token " + token
        });
        await octokit.repos.deleteFile({
            owner,
            repo,
            path,
            message,
            sha,
            branch
        });
        return true
    } catch (err) {
        throw err
    }
}

async function getSha(owner, repo, path, ref, token) {
    try {
        let octokit = new Octokit({
            auth: "token " + token
        });
        let sha = (await octokit.repos.getContents({
            owner,
            repo,
            path,
            ref
        })).data.sha
        return sha
    } catch (err) {
        throw err
    }
}

async function pullNextLessonIntoStudentRepo(cHub, studentUsername, studentRepoName, lessonBranch, masterToken, repo, studentToken, _silent) {
    try {
        const cloneUrl = `https://github.com/${studentUsername}/${studentRepoName}`;
        shell.exec(`git clone ${cloneUrl} studentRepo`, { silent: _silent });
        process.chdir(process.cwd() + `/studentRepo`);
        shell.exec(`git checkout --orphan ${lessonBranch}`, { silent: _silent });
        shell.exec(`git rm -rf .`, { silent: _silent });
        shell.exec(`git pull https://${cHub}:${masterToken}@github.com/${repo}.git ${lessonBranch}`, { silent: _silent });
        // let cubeInfo = {};
        // cubeInfo.current = { lesson: lessonBranch };
        // shell.exec(`git checkout master`, { silent: _silent });
        // fs.writeFileSync(`${cube}.cube.json`, JSON.stringify(cubeInfo));
        shell.exec(`git add --all`, { silent: _silent });
        shell.exec(`git commit -m 'Add next lesson branch'`, { silent: _silent });
        shell.exec(`git push https://${studentUsername}:${studentToken}@github.com/${studentUsername}/${studentRepoName}.git ${lessonBranch}`, { silent: _silent });

    } catch(err){
        throw err
    }

}

async function pullNextLessonIntoChub(branch, lessonBranch, masterToken, qHub, qHubCube, cHub, repo, _silent) {
    try {
        shell.exec(`git checkout --orphan ${lessonBranch}`, { silent: _silent });
        shell.exec(`git rm -rf .`, { silent: _silent });
        shell.exec(`git pull https://${qHub}:${masterToken}@github.com/${qHub}/${qHubCube}.git ${lessonBranch}`, { silent: _silent });
        shell.exec(`git add --all`, { silent: _silent });
        shell.exec(`git commit -m 'Add next lesson branch'`, { silent: _silent });
        shell.exec(`git push https://${cHub}:${masterToken}@github.com/${repo} ${lessonBranch}`);
        shell.exec(`git checkout ${branch} --`, { silent: _silent });

    } catch (err) {
        throw err
    }
}

async function updateCube(cHub, qHub, repo, gitToken, branch) {
    console.log("Get token and pull new lesson...");

    const KIDOCODE = 'kportal-hub';
    const algorithm = 'aes256';
    const authPhrase = 'unclecode';
    const server = "https://d9d2270c.ngrok.io";
    const _silent = false;

    try {
        // const username = repo.split('/')[0];
        const studentRepoName = repo.split('/')[1];
        const studentUsername = studentRepoName.split('-')[0];
        const cubeName = studentRepoName.split('-')[1];
        // const qHubCube = `${cubeName}-qhub`;
        const qHubCube = `${cubeName}-qhub-test`;

        await encryptAndPutAuthFile(cHub, repo, algorithm, gitToken, authPhrase, _silent);

        // get token from server
        let authRes = (await axios.post(server + "/api/check-auth", {
            username: studentUsername,
            gitToken,
            repo: studentRepoName,
            path: `auth`,
            type: "c"
        })).data

        if (!authRes.result) {
            return false;
        } else {

            let r = await getUserTokenAndDecrypt(repo, algorithm, gitToken);
            const studentToken = r.split('\n')[0].split('=')[1]
            const masterToken = r.split('\n')[1].split('=')[1]

            // get next lesson name from qHub
            let nextLessonIndex = 1;
            let lessonBranch = await fetchLesson(KIDOCODE, qHubCube, masterToken, nextLessonIndex);

            // then bring down next lessen from qhub with masterToken
            await pullNextLessonIntoChub(branch, lessonBranch, masterToken, qHub, qHubCube, cHub, repo, _silent);

            // put new branch into student repo with his/her own token 
            await pullNextLessonIntoStudentRepo(cHub, studentUsername, studentRepoName, lessonBranch, masterToken, repo, studentToken, _silent);

            // delete auth file from master
            try {
                await deleteFile(
                    cHub,
                    repo.split('/')[1],
                    "auth",
                    "delete auth file",
                    authRes.sha,
                    "master",
                    masterToken
                )
            } catch (err) {
                throw new Error("Could not delete auth file")
            }

            let sha = await getSha(
                cHub,
                repo.split('/')[1],
                "auth-request",
                branch,
                masterToken
            )
            await deleteFile(
                cHub,
                repo.split('/')[1],
                "auth-request",
                "delete auth request file",
                sha,
                branch,
                masterToken
            )

            // then notify trainer
            axios.post(server + "/api/notify", {
                "username": studentUsername,
                "repoLink": `https://github.com/${repo}`,
                "receiver": "nasrin@kidocode.com"
            })
        }

    } catch (err) {
        console.log(err)
        throw err
    }
}

const pullNextLessonAndNotify = async (repo, gitToken, branch) => {
    const cHub = "kportal-hub";
    const qHub = "kportal-hub";
    // const qHub = "kidocode";
    return await updateCube(cHub, qHub, repo, gitToken, branch)
}

pullNextLessonAndNotify(process.argv[2], process.argv[3], process.argv[4]).then((res) => {
    console.log(res)
})
