// actions on push on chub
const fs = require('fs');
const Octokit = require("@octokit/rest");
const axios = require("axios");
const shell = require("shelljs");
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

async function encryptAndPutAuthFile(username, repo, algorithm, gitToken, authPhrase, _silent) {
    try {
        // var cipher = crypto.createCipher(algorithm, gitToken);
        // var encryptedPhrase = cipher.update(authPhrase, 'utf8', 'hex');
        // encryptedPhrase += cipher.final('hex');
        let encryptedPhrase = await encrypt(authPhrase, algorithm, gitToken)
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
        if(!resp.data.content)
            throw new Error("No auth file found");
        let content = Buffer.from(resp.data.content, 'base64').toString('ascii').replace(/\n/g, "");
        let token = await decrypt(content, algorithm, pwd);
        return token;
    } catch (err) {
        throw err
    }
}

async function fetchStartLesson(qHub, token, qHubCube) {
    console.log("Getting first lesson name...");
    try {
        let octokit = new Octokit({
            auth: "token " + token
        });
        let resp = await octokit.repos.getContents({
            owner: qHub,
            repo: qHubCube,
            path: `lessons.index`,
            headers: {
                'accept': 'application/vnd.github.VERSION.raw'
            }
        });
        let scenarioResp = await octokit.repos.getContents({
            owner: qHub,
            repo: qHubCube,
            path: `default.index`,
            headers: {
                'accept': 'application/vnd.github.VERSION.raw'
            }
        });
        return {
            result: true,
            lessons: resp.data,
            scenario: scenarioResp.data
        }
    } catch (err) {
        return {
            result: false,
            error: "Couldn't get first lesson: " + err.message
        }
    }
}

// async function pullFirstLesson(lessonsIndex, username, cube, token, cHub, qHub, qHubCube) {
async function pullFirstLesson(cubeIndex, username, cube, token, cHub, qHub, qHubCube) {
    try {
        let lessonsIndex = cubeIndex.lessons;
        let lessonsScenario = cubeIndex.scenario;
        let initLessonBranch = lessonsIndex.split("\n").filter(Boolean)[0];
        console.log(`Fetching the first lesson '${initLessonBranch}'...`);

        const cloneUrl = `https://github.com/${cHub}/${username}-${cube}-cube`;
        const _silent = true;

        shell.exec(`git clone ${cloneUrl}`, { silent: _silent });
        process.chdir(process.cwd() +  `/${username}-${cube}-cube`);
        shell.exec(`git checkout --orphan ${initLessonBranch}`, { silent: _silent });
        shell.exec(`git rm -rf .`, { silent: _silent });
        shell.exec(`git pull https://${qHub}:${token}@github.com/${qHub}/${qHubCube}.git ${initLessonBranch}`, { silent: _silent });
        
        shell.exec(`git checkout master`, { silent: _silent });
        let cubeInfo = JSON.parse(fs.readFileSync(`${cube}.cube.json`, "utf8")) || {};
        let docsCubeInfo = JSON.parse(fs.readFileSync(`docs/${cube}.cube.json`, "utf8")) || {};
        // let cubeInfo = {};
        cubeInfo.current = {
            lesson: initLessonBranch,
            scenario: lessonsScenario.split('\n').filter(Boolean)
        };
        cubeInfo.lessons = {}
        lessonsIndex.split("\n").filter(Boolean).forEach(l => {
            cubeInfo.lessons[l] = {
                test: {
                    status: "pending"
                }
            }
        });

        docsCubeInfo.current = cubeInfo.current;
        docsCubeInfo.lessons = cubeInfo.lessons;
        
        // shell.exec(`git checkout master`, { silent: _silent });
        
        fs.writeFileSync(`${cube}.cube.json`, JSON.stringify(cubeInfo, null, 4));
        
        // save a.cube.json and a.user.json in docs folder
        fs.writeFileSync(`docs/${cube}.cube.json`, JSON.stringify(docsCubeInfo, null, 4));
        
        // add lesson.index
        fs.writeFileSync(`lessons.index`, lessonsIndex);
        fs.writeFileSync(`default.index`, lessonsScenario);
        
        shell.exec(`git add --all`, { silent: _silent });
        shell.exec(`git commit -m 'Add first lesson branch'`, { silent: _silent });
        shell.exec(`git push https://${cHub}:${token}@github.com/${cHub}/${username}-${cube}-cube.git --all`, { silent: _silent });
        
        return {
            result: true
        }

    } catch (err) {
        return {
            result: false,
            error: "Couldn't pull First Lesson to cHub: " + err.message
        }
    }
}

async function forkChubCube(username, cube, cHub, teacher, token) {
    console.log("Forking to student repo...");
    try {
        let octokit = new Octokit({
            auth: "token " + token
        });
        await octokit.repos.createFork({
            owner: cHub,
            repo: `${username}-${cube}-cube`
        });
        // add collaborator
        let cRes = await octokit.repos.addCollaborator({
            owner: username,
            repo: `${username}-${cube}-cube`,
            username: teacher
        })
        // accept invitation
        await axios.post(
            'https://webhooks.mongodb-stitch.com/api/client/v2.0/app/kportal-grmuv/service/kportalWeb/incoming_webhook/acceptGitInvitation?secret=secret', {
            "invitation_id": cRes.data.id,
            "username": teacher
        });
        
        return {
            result: true,
            repoLink: `https://github.com/${username}/${username}-${cube}-cube`
        }
    } catch (err) {
        console.log(err)
        return {
            result: false,
            error: "Couldn't Fork repo: " + err.message
        }
    }
}

async function enableStudentPage(username, cube, token) {
    console.log("Enable git page for student repo...");
    try {
        let octokit = new Octokit({
            auth: "token " + token
        });
        
        // enable page
        await octokit.repos.enablePagesSite({
            owner: username,
            repo: `${username}-${cube}-cube`,
            source: {
                "branch": "master",
                "path": "/docs"
            },
            headers: {
                accept: "application/vnd.github.switcheroo-preview+json"
            }
        })

        console.log("Done.");
        return {
            result: true,
            repoLink: `https://github.com/${username}/${username}-${cube}-cube`
        }
    } catch (err) {
        console.log(err)
        return {
            result: false,
            error: "Couldn't enable page: " + err.message
        }
    }
}

async function addActions(branch, username, cube, masterToken, studentToken, cHub, qHub, qHubCube) {
    try {
        let octokit = new Octokit({
            auth: "token " + masterToken
        });
        let stdOctokit = new Octokit({
            auth: "token " + studentToken
        });

        let d = (await octokit.repos.getContents({
            owner: qHub,
            repo: qHubCube,
            path: "",
            ref: branch + "-actions"
        })).data;

        let cHubFiles = d.filter(f => !f.name.endsWith(".gitignore") && !f.name.startsWith("onPushLesson")).map(f => f.name);
        let studentFiles = d.filter(f => !f.name.endsWith(".gitignore") && (f.name.startsWith("onPushLesson") || f.name.startsWith("pushTestResult"))).map(f => f.name);

        for (let idx = 0; idx < cHubFiles.length; idx++) {
            const _file = cHubFiles[idx];
            console.log(_file);
            let d = (await octokit.repos.getContents({
                owner: qHub,
                repo: qHubCube,
                path: _file,
                ref: branch + "-actions"
            })).data;
            await octokit.repos.createOrUpdateFile({
                owner: cHub,
                repo: `${username}-${cube}-cube`,
                path: ".github/workflows/" + _file,
                message: "initial commit",
                content: d.content,
                branch: branch
            })
        }

        // student repo actions
        for (let idx = 0; idx < studentFiles.length; idx++) {
            const _file = studentFiles[idx];
            console.log(_file);
            let d = (await octokit.repos.getContents({
                owner: qHub,
                repo: qHubCube,
                path: _file,
                ref: branch + "-actions"
            })).data;
            await stdOctokit.repos.createOrUpdateFile({
                owner: username,
                repo: `${username}-${cube}-cube`,
                path: ".github/workflows/" + _file,
                message: "initial commit",
                content: d.content,
                branch: branch
            })
        }
        
        console.log("Done.");

    } catch (err) {
        console.log(err)
    }

}

async function deleteFile(owner, repo, path, message, branch, token) {
    try {
        let octokit = new Octokit({
            auth: "token " + token
        });
        let sha = (await octokit.repos.getContents({
            owner,
            repo,
            path,
            ref: branch
        })).data.sha;
        if (sha) {
            await octokit.repos.deleteFile({
                owner,
                repo,
                path,
                message,
                sha,
                branch
            });
            return true;
        } else {
            throw new Error(" no sha found to remove auth file in master branch in " + repo + "repo!");
        }
    } catch (err) {
        throw err
    }
}

let initCube = async (username, cube, repo, gitToken) => {
    const algorithm = 'aes256';
    const authPhrase = 'unclecode';
    const server = "https://cubie.now.sh";
    const cHub = 'kportal-hub';
    const qHub = 'kportal-hub'; 
    const _silent = false;
    
    try {
        const qHubCube = `${cube}-qhub-test`; //`${cube}-qhub`
        const cHubCube = `${username}-${cube}-cube`; 
        
        // TODO
        const teacher = `nascoder`; 

        // create encrypted auth file and send it to server to get tokens
        await encryptAndPutAuthFile(cHub, repo, algorithm, gitToken, authPhrase, _silent);

        // get token from server
        let authRes = (await axios.post(server + "/api/check-auth", {
            username,
            gitToken,
            repo: cHubCube,
            path: `auth`,
            type: "c"
        })).data

        if (!authRes.result) {
            throw new Error("Unauthorized Access")
            // return false;
        } else {

            let r = await getUserTokenAndDecrypt(repo, algorithm, gitToken);
            const studentToken = r.split('\n')[0].split('=')[1]
            const masterToken = r.split('\n')[1].split('=')[1]

            // ========================================== func 1 - get lesson
            let res = await fetchStartLesson(qHub, masterToken, qHubCube);
            if (res.result) {
                let initLessonBranch = res.lessons.split("\n").filter(Boolean)[0];

                // ========================================== func 2
                await pullFirstLesson(res, username, cube, masterToken, cHub, qHub, qHubCube);
                // await pullFirstLesson(res.lessons, username, cube, masterToken, cHub, qHub, qHubCube);

                // ========================================== func 6 - delete auth file
                await deleteFile(
                    cHub, // owner
                    cHubCube, // repo
                    "auth", // path
                    "delete auth request file",
                    "master", // branch
                    masterToken
                );
                
                // ========================================== func 3 - fork cube repo
                await forkChubCube(username, cube, cHub, teacher, studentToken);
                
                // ========================================== func 4 - enable page
                let resp = await enableStudentPage(username, cube, studentToken);

                // ========================================== func 5 - add actions file for chub and student repo
                await addActions(initLessonBranch, username, cube, masterToken, studentToken, cHub, qHub, qHubCube);
                
                return resp;
            }
            return res
        }
        
    }
    catch(err){
        console.log(`Couldn't create and fetch lesson for ${cube}`, err )
        return false;
    }
}

const cubeOnPush = async (repo, gitToken) => {
    const cube = JSON.parse(fs.readFileSync(process.env.NODE_CUBE, 'utf8')).commits[0].message.split(".")[0];
    if (!(["modified", "complete"].includes(cube))) {
        const userInfo = JSON.parse(fs.readFileSync(`${cube}.user.json`, 'utf8'))
        return await initCube(userInfo.username, cube, repo, gitToken)
    }
}

cubeOnPush(process.argv[2], process.argv[3]).then((res) => {
    console.log(res)
})
