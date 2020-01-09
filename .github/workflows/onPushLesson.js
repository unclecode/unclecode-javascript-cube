const shell = require("shelljs")
const axios = require("axios");
const Octokit = require("@octokit/rest");
// const crypto = require('crypto');
const { createCipheriv, createDecipheriv, randomBytes } = require('crypto');

const inputEncoding = 'utf8';
const outputEncoding = 'hex';

async function encrypt(content, algorithm, key) {
    try {
        key = key.substr(key.length - 32);
        const iv = new Buffer.from(randomBytes(16), 'hex');
        const cipher = createCipheriv(algorithm, key, iv);
        let crypted = cipher.update(content, inputEncoding, outputEncoding);
        crypted += cipher.final(outputEncoding);
        return `${iv.toString('hex')}:${crypted.toString()}`;
    } catch (err) {
        console.log(err.message);
        throw err
    }
}

async function decrypt(content, algorithm, key) {
    try {
        key = key.substr(key.length - 32);
        const textParts = content.split(':');
        const IV = new Buffer.from(textParts.shift(), outputEncoding);
        const encryptedText = new Buffer.from(textParts.join(':'), outputEncoding);
        const decipher = createDecipheriv(algorithm, key, IV);
        let decrypted = decipher.update(encryptedText, outputEncoding, inputEncoding);
        decrypted += decipher.final(inputEncoding);
        return decrypted.toString()
        // return {
        //     result: true,
        //     decrypted: decrypted.toString()
        // }
    } catch (err) {
        console.log(err)
        throw err
    }
}

async function encryptAndPutAuthFile(username, repo, algorithm, gitToken, authPhrase) {
    try {
        // var cipher = crypto.createCipher(algorithm, gitToken);
        // var encryptedPhrase = cipher.update(authPhrase, 'utf8', 'hex');
        // encryptedPhrase += cipher.final('hex');
        let encryptedPhrase = await encrypt(authPhrase, algorithm, gitToken);
        shell.exec(`git checkout master`);
        shell.exec(`echo ${encryptedPhrase} > auth`);
        shell.exec(`git add auth`);
        shell.exec(`git commit -m 'add auth file'`);
        shell.exec(`git push https://${username}:${gitToken}@github.com/${repo} master`);
    } catch (err) {
        throw err
    }
}

async function getUserTokenAndDecrypt(repo, algorithm, pwd) {
    try {
        let resp = await axios.get(`https://api.github.com/repos/${repo}/contents/auth`);
        if(!resp.data.content)
            throw new Error("No auth file found");
        let content = Buffer.from(resp.data.content, 'base64').toString('ascii').replace(/\n/g, "");
        // var decipher = crypto.createDecipher(algorithm, pwd);
        // var token = decipher.update(content, 'hex', 'utf8');
        // token += decipher.final('utf8');
        let token = await decrypt(content, algorithm, pwd);
        return token;
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

async function sendPullToChub(cHub, repo, gitToken, branch, actor) {
    if(actor !== "kportal-hub"){
        const algorithm = 'aes256';
        const authPhrase = 'unclecode';
        const server = "https://cubie.now.sh";

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

                // create auth-req file to trigger action by hub, not the user that requests for PR
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
    return true;
}

const onTestSuccess = async (repo, gitToken, branch, actor) => {
    const cHub = "kportal-hub";
    return await sendPullToChub(cHub, repo, gitToken, branch, actor)
}

onTestSuccess(process.argv[2], process.argv[3], process.argv[4], process.argv[5]).then((res) => {
    console.log(res)
})
