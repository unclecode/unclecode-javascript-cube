const jest = require("jest");

const options = {
    projects: [__dirname],
    silent: true,
};

jest
    .runCLI(options, options.projects)
    .then((success) => {
        console.log(success.results.testResults);
    })
    .catch((failure) => {
        console.error(failure);
    });