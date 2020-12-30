import http = require('http');
import path = require('path');
import I = require('./Interfaces');
let express = require('express');
let bodyParser = require('body-parser');
let morgan = require('morgan');
let favicon = require('serve-favicon');
import GameServerController = require('./controllers/GameServer');
import GameServer = require('./GameServer');
let settings: I.Settings = require('./config/settings');
let logger = require('./logger');

let app = express();
let jsonFormatter = function (tokens: any, req: any, res: any) {
    let obj: any = {
        url: tokens.url(req, res),
        statusCode: tokens.status(req, res),
        durationMs: parseInt(tokens['response-time'](req, res), 10)
    };
    return JSON.stringify(obj);
}
app.use(morgan(jsonFormatter, { stream: logger.stream }));
//Fix so that bodyParser will work even though the client doesn't set content-type
app.all('*', function (req: any, res: any, next: any) {
    if (!req.headers['content-type']) {
        req.headers['content-type'] = 'application/x-www-form-urlencoded';
    }
    next();
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.static(path.join(__dirname, 'public')));


app.use(favicon(__dirname + '/public/images/favicon.ico'));

////Sets header for all responses
//app.all('*', (req: any, res: any, next: any) => {
//    //console.log("Routing Request for " + req.path);
//    next();
//});

//Routes
app.get('/admin', GameServerController.admin);
app.get('/displayLog*', GameServerController.displayLog);
app.get('/runningGames*', (req: any, res: any) => {
    res.redirect('/admin');
});
app.post('/patchManually', GameServerController.patchManually); // expecting req to contain "patchpath" which is the link to the update patch
app.get('/getCurrentPatchLine', GameServerController.getCurrentPatchLine);

app.get('/killProcessManually*', GameServerController.killProcessManually);
app.get('/killJobManually', GameServerController.killJobManually);

app.get('/status', GameServerController.status);

app.get('/isRunning', (req: any, res: any) => {
    res.json(200, true);
});

app.post('/disable', GameServerController.disable);
app.post('/enableAndConfigure', GameServerController.enableAndConfigure);

app.post('/GameInitialized', GameServerController.GameStarted);

app.post('/UpdateActiveHumanPlayerCount', GameServerController.updateActiveHumanPlayerCount);

app.get('/getGameServerData', GameServerController.getGameServerData); 


//Catch all to close response for non routed routes
app.all('*', (req: any, res: any) => {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.write("404");
    res.end();
});

process.on('uncaughtException', function (err: any) {
    logger.error(err.stack);
    logger.info("Node NOT Exiting...");
    debugger;
});

app.listen(settings.httpPort);
GameServer.initialize();
logger.info("GameServer has started");
let printableSettings: any = settings;
logger.info(JSON.stringify(printableSettings.__proto__, null, 2));
