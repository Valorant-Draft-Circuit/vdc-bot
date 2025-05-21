module.exports = {
    name: `template`, // this is the name/value of the command
    readable: `Readable Template`, // this shows in the selection option

    helpResponse: [
        `A short description of the report and what it does`,
        [
            // add information & examples for arguments here
        ].map(data => `> ${data}`).join(`\n`),
    ].join(`\n\n`),
    args: [], // this is the list of arguments that can be passed to the command

    // the generator function
    async generate(args) {
        let out = ``;

        return { text: out };
    }
}
