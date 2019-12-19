const crypto = require('crypto');
const shell = require("shelljs")
const axios = require("axios");
const Octokit = require("@octokit/rest");

async function encryptAndPutAuthFile(username, repo, algorithm, gitToken, authPhrase) {
    try {
        var cipher = crypto.createCipher(algorithm, gitToken);
        var encryptedPhrase = cipher.update(authPhrase, 'utf8', 'hex');
        encryptedPhrase += cipher.final('hex');
        shell.exec(`git checkout master`);
        shell.exec(`echo ${encryptedPhrase} > auth`);
        shell.exec(`git add auth`);
        shell.exec(`git commit -m 'add auth file'`);
        shell.exec(`git push https://${username}:${gitToken}@github.com/${repo} master`);
    } catch (err) {
        throw err
    }
}

async function openPullReq(token, cHub, repo, username, branch) {
    try {
        let octokit = new Octokit({
            auth: "token " + token
        });
        await octokit.pulls.create({
            owner: cHub,
            repo,
            head: `${username}:${branch}`,
            base: branch,
            title: branch,
            body: "Please pull new changes in"
        });
        return true
    } catch (err) {
        if (err.status === 422) {
            return true
        }
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

async function deleteFile(owner, repo, path, message, sha, token) {
    try {
        let octokit = new Octokit({
            auth: "token " + token
        });
        await octokit.repos.deleteFile({
            owner,
            repo,
            path,
            message,
            sha
        });
        return true
    } catch (err) {
        throw err
    }
}

async function sendPullToChub(cHub, repo, gitToken, branch) {
    const algorithm = 'aes256';
    const authPhrase = 'unclecode';
    const server = "https://d9d2270c.ngrok.io";

    try {
        let username = repo.split('/')[0]
        let _repo = repo.split('/')[1]

        await encryptAndPutAuthFile(username, repo, algorithm, gitToken, authPhrase);

        let authRes = (await axios.post(server + "/api/check-auth", {
            username,
            gitToken,
            repo: _repo,
            path: `auth`,
            type: 's'
        })).data

        if (!authRes.result) {
            return false;
        } else {
            var user_token = await getUserTokenAndDecrypt(repo, algorithm, gitToken);
            user_token = user_token.split('=')[1];

            await openPullReq(user_token, cHub, _repo, username, branch);

            shell.exec(`git checkout ${branch}`);

            await axios.post(server + "/api/generate-auth-req", {
                repo: _repo, branch
            })

            // delete auth file from master
            await deleteFile(
                username,
                _repo,
                "auth",
                "delete auth file",
                authRes.sha,
                user_token
            )

            console.log("DONE");
            return true
        }

    } catch (err) {
        throw err
    }
}

const onTestSuccess = async (repo, gitToken, branch) => {
    const cHub = "kportal-hub";
    return await sendPullToChub(cHub, repo, gitToken, branch)
}

onTestSuccess(process.argv[2], process.argv[3], process.argv[4]).then((res) => {
    console.log(res)
})
