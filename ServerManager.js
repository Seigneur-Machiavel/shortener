// ServerManager.js
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

function StartServer(exec_args = "", custom_output = ' > output.log 2>&1 &') {
    console.log(`exec: node server.js${exec_args}${custom_output}`);
    exec(`node server.js${exec_args}${custom_output}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing the script ServerManager.js: ${error}`);
            return;
        }
        console.log('The script ServerManager.js has been executed');
    });
}

function build_arg_string_from_array(args_) {
    let arg_string = "";
    args_.forEach(arg => {
        arg_string += ` ${arg}`;
    });
    return arg_string;
}

async function gitPull_wait_finish() {
    try {
        const { stdout, stderr } = await execAsync(`git pull origin main`);
        return true
    } catch (error) {
        console.error(`Error executing "git pull origin main": ${error}`);
        return false
    }
}

const args = process.argv.slice(2);
// get the first arg and remove it
const task = args.shift();
//const task = "gitpull"

setTimeout(async () => {
    switch (task) {
        case 'restart':
            StartServer(build_arg_string_from_array(args));
            break;
        case 'gitpull':
            await gitPull_wait_finish()
            StartServer(build_arg_string_from_array(args));
            break;
        default:
            console.log('Unknown task');
    }
    return 0;
}, 1000);