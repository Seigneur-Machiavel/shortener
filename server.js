const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const { exec } = require('child_process');

//#region - CLASSES
/**
 * @class redirect
 * @param {string} o originalUrl - the url to redirect to
 * @param {number} s selfDestruct - number of clicks before the url is deleted (default = 0)
 * @param {number} e expiration - time in seconds before the url is deleted (default = settings.de)
 * @param {boolean} save - if the url should be saved in the database (default = false)
 * @param {number} c clicks (default = 0)
 * @param {number} t time (default = Date.now())
 */
class redirect {
    constructor(o, s = 0, e = settings.de, save = false) {
        this.o = o;
        this.s = s;
        this.e = e;
        this.save = save;
        this.c = 0;
        this.t = Date.now();
    }
}
//#endregion

//#region - SETTINGS - LAUNCH ARGUMENTS
const inspector = require('inspector');
const is_debug = inspector.url() !== undefined ? true : false;
console.log(`is_debug: ${is_debug}`);

const settings = {
  p: 4325, // Port
  ar: false, // Auto restart
  da: false, // Disable admin token usage
  lr: false, // Log routes
  ul: is_debug ? false : true, // Use launch folder as subdomain
  t: "NzQxNzQ2NjEwNjQ0NjQwMzg4XyOg3Q5fJ9v5Kj6Y9o8z0j7z3QJYv6K3c", // admin Token
  de: 3600, // Default expiration time in seconds (1 hour)
  infiniteLoopDelay: 10000, // Delay between each infinite loop iteration
  ForbiddenShortUrls: ["shorten", "info", "restart", "gitpull", "chat"], // Short urls that can't be used
}
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  // Check if the argument starts with "-"
  if (arg.startsWith("-")) {
      // Get the key by removing the "-"
      const key = arg.slice(1);
      if (key == "ar") { settings.ar = true; continue; }
      if (key == "lr") { settings.lr = true; continue; }
      if (key == "rd") { settings.ul = false; continue; } // [root domain] - Don't use launch folder as subdomain

      // Move to the next argument
      i++;
      const value = args[i];

      // if string value is valid number
      if (key == "p" && !isNaN(value)) {settings[key] = Number(value); continue;}
      if (key == "de" && !isNaN(value)) {settings[key] = Number(value); continue;}

      // Add the key and value to the launchArguments object
      settings[key] = value;
  }
}
const launch_folder = settings.ul ? __dirname.split('\\').pop().split('/').pop() : "";
if (settings.ul) { console.log(`launch_folder: ${launch_folder}`) }; // Get the name of the folder where the server is launched
let exit_task = ""; // Exit task to execute when the server is exiting
//#endregion ----------------------------------------------

//#region - SIMPLE FUNCTIONS
function executeServerManagerScript(exec_args = "") {
    const arg_ = exec_args ? ` ${exec_args}` : ""
    exec(`node ServerManager.js${arg_}`, (error, stdout, stderr) => {
      if (error) { console.error(`Error executing the script ServerManager.js: ${error}`); return; }
      console.log('The script ServerManager.js has been executed');
    });
}
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1) + min); }
function rndCharKey() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return chars[rnd(0, chars.length - 1)];
}
function createKey(length) {
    // create a key that is not in ForbiddenShortUrls
    let key = "";
    while (key == "" || settings.ForbiddenShortUrls.includes(key)) {
        key = "";
        for (let i = 0; i < length; i++) { key += rndCharKey(); }
    }
    return key;
}
function nomberOfCharsRequired() {
    const urls_length = Object.keys(urls).length;
    if (urls_length < 3844) { return 3; }
    if (urls_length < 238328) { return 4; }
    if (urls_length < 14776336) { return 5; }
    if (urls_length < 916132832) { return 6; }
    if (urls_length < 56800235584) { return 7; }
    if (urls_length < 3521614606208) { return 8; }
    if (urls_length < 218340105584896) { return 9; }
    return 10;
}
async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function infiniteLoop() { 
    while (true) { 
        await sleep(settings.infiniteLoopDelay);
        const expired_urls = getListOfExpiredUrls();
        if (expired_urls.length > 0) {
            console.log(`Deleting ${expired_urls.length} expired URLs...`);
            expired_urls.forEach(key => { delete urls[key]; });
        }
    }
}
function getListOfExpiredUrls() {
    const expired_urls = [];
    Object.keys(urls).forEach(key => {
        const url = urls[key];
        if (url.e != 0 && url.e <= Math.floor((Date.now() - url.t) / 1000)) { expired_urls.push(key); }
    });
    return expired_urls;
}
infiniteLoop();
//#endregion --------------------------------------------------------------

// Use body-parser middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

// Route to listen root domain (ex: localhost:4321) & replace "launch_folder" by the name of the folder
app.get(['/', '//'], (req, res) => { res.render('index', {"launch_folder": launch_folder}); });

const urls = {};
// Route for creating a new short URL
app.get(['/shorten', '//shorten'], (req, res) => {
    // o = originalUrl
    // s = selfDestruct
    let { o, s, e, save, name } = req.query;
    if (s == undefined) { s = 0; }

    // Use the specified name or create a new one
    let shortUrl = name ? name : createKey(nomberOfCharsRequired());
    if (urls[shortUrl] && name ) { res.status(409).json({ error: 'Name already taken' }); return; }

    // Verify if the short URL already exists and create a new one if it does
    while (urls[shortUrl]) {
        shortUrl = createKey(nomberOfCharsRequired());
    }

    // Add the URL to the list
    urls[shortUrl] = new redirect(o, s, e, save);

    // console.log(`Shorted: ${shortUrl} | o= ${o} | s= ${s}`);

    // Return the entire short url
    res.json({ shortUrl: `https://${req.hostname}/${shortUrl}` });
});

// Route for redirecting to the original URL
app.get(['/:shortUrl', '//:shortUrl'], (req, res) => {
    const { shortUrl } = req.params;

    // Find the original URL by its short URL
    const url = urls[shortUrl];
    if (!url) { res.status(404).json({ error: 'URL not found - or expired' }); return }

    // Increment the number of clicks
    url.c++;

    // Redirect to the original URL
    res.redirect(url.o);

    // Verify if the URL should be deleted
    if (url.s != 0 && url.c >= url.s) {
        // Delete the URL from the list after a delay of 2 seconds
        setTimeout(() => { delete urls[shortUrl]; }, 2000);
    }
});

// Route for getting info about a short URL
app.get(['/info/:shortUrl', '//info/:shortUrl'], (req, res) => {
    const { shortUrl } = req.params;

    // Find the original URL by its short URL
    const url = urls[shortUrl];
    if (!url) { res.status(404).json({ error: 'URL not found - or expired' }); return }

    const url_public_info = {
        "shortUrl": `https://${req.hostname}/${shortUrl}`,
        "selfDestruct": url.s,
        "expiration": url.e,
        "save": url.save,
        "clicks": url.c,
        "remainingClicks": url.s - url.c,
        "time": url.t,
        "remainingTime": url.e - Math.floor((Date.now() - url.t) / 1000),
    }

    // Return the info
    res.json(url_public_info);
});

// Route to restart the server && git pull origin main
if (!is_debug && !settings.da) { // If admin token usage is not disabled
    const restartHandler = (req, res) => { exit_task = "restart"; res.render('simple_msg', {"launch_folder": launch_folder, "message": "Server is restarting..."}); process.exit(0) }
    const gitpullHandler = (req, res) => { exit_task = "gitpull"; res.render('simple_msg', {"launch_folder": launch_folder, "message": "Server is restarting after 'git pull origin main'..."}); process.exit(0) }
    app.get([`/restart/${settings.t}`, `//restart/${settings.t}`], restartHandler);
    app.get([`/gitpull/${settings.t}`, `//gitpull/${settings.t}`], gitpullHandler);
    
    console.log("Admin routes are enabled: /restart, /gitpull");
}

// Log all routes
function logRoutes() {
    const routes = app._router.stack.filter(layer => layer.route).map(layer => {
      return {
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      };
    });
    console.log('---');
    // Affichez les routes dans la console
    routes.forEach(route => {
      console.log(`Path: ${route.path}`);
      console.log(`Methods: ${route.methods.join(', ')}`);
      console.log('---');
    });
  
    app.use((req, res, next) => { if (req.method === 'GET') { console.log(`Received GET request for ${req.url}`); } next(); });
}; if (settings.lr || is_debug) { logRoutes() };

// Start the server
app.listen(settings.p, () => {
    console.log(`Server started on port ${settings.p}`);
});

// EXIT HANDLER
process.on('exit', () => {
    // If no exit task, and auto restart is enabled, set the exit task to "restart"
    if (exit_task === "" && settings.ar) { exit_task = "restart" }
    if (exit_task === "") { return; } // If no exit task, exit the process
  
    // Add the arguments to the exit task
    args.forEach(arg => { exit_task += " "+ arg })
  
    // Execute the ServerManager.js script with the exit task as argument
    executeServerManagerScript(exit_task);
    console.log(`exit_task: ${exit_task}`);
});