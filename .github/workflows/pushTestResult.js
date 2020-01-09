const shell = require("shelljs")
const fs = require("fs");
const Octokit = require("@octokit/rest");

// async function putTestResultFile(gitToken, owner, repo, branch, path, content) {
async function putTestResultFile(gitToken, owner, repo, branch, path, testContent, isMaster) {
    try {
        let octokit = new Octokit({
            auth: "token " + gitToken
        });
    
        let res;
        try {
            res = await octokit.repos.getContents({
                owner,
                repo,
                path,
                ref: isMaster ? "master" : branch
            });
        } catch (e) {
            if (e.status !== 404)
                throw e
        }
        let sha = false;
        let content = {};
        if (res) {
            sha = res.data.sha;
            content = JSON.parse(Buffer.from(res.data.content, 'base64').toString('ascii'));
        }
        if (isMaster){
            content[branch] = testContent;
            content = Buffer.from(JSON.stringify(content, null, 4)).toString('base64');
        }
        else
            content = Buffer.from(JSON.stringify(testContent, null, 4)).toString('base64');

        let opt = {
            owner,
            repo,
            path,
            message: `update ${branch} test result, triggered by CHub action`,
            content,
            branch: isMaster ? "master" : branch
        };
        if (sha) {
            opt.sha = sha;
        }
        await octokit.repos.createOrUpdateFile(opt);
        
        return true;

    } catch (err) {
        console.log("Could not put Test Result File: ", err)
        throw err
    }
}

async function push(cHub, repo, gitToken, branch, actor) {
    console.log("Push test result");
    if (actor === "kportal-hub") {
        try {
            const _repo = repo.split('/')[1];
            const silent = false;

            shell.exec(`git checkout ${branch}-test --`, {silent});
            shell.exec(`git add --all`, {silent});
            shell.exec(`git commit -m "save"`, {silent});

            const testResult = JSON.parse(fs.readFileSync("__tests__/result.json", "utf8"));

            if (testResult) {
                // let content = Buffer.from(testResult).toString('base64');
                
                // put test result for branch itself
                console.log(`Put test result for ${branch} branch`);
                await putTestResultFile(gitToken, cHub, _repo, branch, "__tests__/result.json", testResult, false);
                console.log("Done");
                
                // put test result for master branch 
                console.log(`Put test result for master branch`);
                await putTestResultFile(gitToken, cHub, _repo, branch, "docs/result.json", testResult, true);
                console.log("Done");

                return true;
            }
            
            console.log("No test result file found");
            return false;

        } catch (err) {
            throw err
        }
    }
    // if(actor !== "kportal-hub"){
    else {
        try {
            const silent = false;
            let username = actor !== "kportal-hub" ? repo.split('/')[0] : cHub;

            console.log(`git push https://${username}:${gitToken}@github.com/${repo} ${branch}`)

            shell.exec(`git checkout ${branch} --`, {silent});
            shell.exec(`git add __tests__/result.json`, {silent});
            shell.exec(`git commit -m 'save test result triggered by action'`, {silent});
            shell.exec(`git push https://${username}:${gitToken}@github.com/${repo} ${branch}`, {silent});

            console.log("Done");

            return true;

        } catch (err) {
            throw err
        }
    }
    // return true;
}

const pushTestResult = async (repo, gitToken, branch, actor) => {
    let cHub = "kportal-hub"
    return await push(cHub, repo, gitToken, branch, actor)
}

pushTestResult(process.argv[2], process.argv[3], process.argv[4], process.argv[5]).then((res) => {
    console.log(res)
})