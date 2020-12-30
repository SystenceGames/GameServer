import express = require('express');
import assert = require('assert');
import proc = require('child_process');
import async = require('async');
import Q = require('q');
import fs = require('fs');
let logger = require('../logger');
import GameServer = require('../GameServer');
import settings = require('../config/settings');
import I = require('../Interfaces');

export function status(req: express.Request, res: express.Response) {
    Q.fcall(GameServer.getStatus)
        .then((status) => { res.json(200, status); })
        .catch((err) => {
            res.json(500, { error: err })
        })
        .done();
}

export function enableAndConfigure(req: express.Request, res: express.Response) {
    Q.fcall(() => {
        assert(req.body.patchLine, 'patchLine missing');
        assert(req.body.queueURL, 'queueURL missing');
        assert(req.body.serverAddress, 'serverAddress missing');
        assert(req.body.publicPorts, 'publicPorts missing');
        let publicPorts = JSON.parse(req.body.publicPorts);
        assert(Array.isArray(publicPorts), 'publicPorts should be an array');
        return publicPorts;
    })
        .then((publicPorts) => {
            GameServer.enableAndConfigure(req.body.patchLine, req.body.queueURL, req.body.serverAddress, publicPorts);
            res.json(200);
        })
        .catch((err) => {
            res.json(500, { error: err })
        })
        .done();
}

export function disable(req: express.Request, res: express.Response) {
    GameServer.disable();
    res.json(200);
}

export function GameStarted(req: express.Request, res: express.Response) {
    Q.fcall(() => {
        assert(req.body.jobID, 'jobID missing');
        return req.body.jobID;
    })
    .then(GameServer.gameStarted)
    .then(() => {
        res.status(200).json({ success: true });
    })
    .catch((err) => {
        logger.error("Server failed to identify a game to trigger the start of", { err: err } );
        res.status(500).json({ error: "GameServer failed to identify a game to trigger the start of", err: err });
    })
    .done();
}

export function updateActiveHumanPlayerCount(req: express.Request, res: express.Response) {
    promiseForUpdateActiveHumanPlayerCount(req, res).done();
}

export function promiseForUpdateActiveHumanPlayerCount(req: express.Request, res: express.Response) : Q.Promise<void> {
    let promise: Q.Promise<void> = Q.fcall(() => {
        assert(req.body.jobID, 'jobID missing');
        assert(req.body.activeHumanPlayerCount, 'activeHumanPlayerCount missing');
        res.status(200);
        GameServer.setActiveHumanPlayerCount(req.body.jobID, req.body.activeHumanPlayerCount);
    })
    .catch((err) => {
        logger.error("Something went wrong updating active human player count.", err);
    });
    return promise;
}
//'Legacy' code below here. Only admin references the GameServer.js class
//(AKA I think its usefull to leave behind these manual controls into the GameServer, but am too lazy to use the new code! And its useful to have alternate ways to do actions that I know work)

function assertInputExists(input: string, callback: (err: Error) => void) {
    let err: Error = null;
    if (!input) {
        err = new Error("Parameter missing");
    }
    callback(err);
}

export function patchManually(req: express.Request, res: express.Response) {
    //check if the variable even exists or not first!
    if (req.body.patchpath) {
        //run the patcher with the input
        proc.execFile(settings.PathToPatcher, [req.body.patchpath], {}, function (error: any, stdout, stderr) {
            if (error !== null) {
                if (error.code === 1 || error.code === 0) {
                    logger.info('Error Code is 0 or 1: Patcher is OK', { codepath: "GameServer.patch", errorCode: error.code, errorMessage: error.message, stdout: stdout, stderr: stderr });
                    res.end("Sent from patch(): \noutput msg: " + error.message + "\nexit code: " + error.code);
                } else {
                    logger.warn('Patching failed', { codepath: "GameServer.patch", errorCode: error.code, errorMessage: error.message, stdout: stdout, stderr: stderr });
                    res.writeHead(500);
                    res.end("Sent from patch(): \nerr msg: " + error.message + "\nexit code: " + error.code);
                }
            } else { // this is normal case
                res.end("Patch request received with no errors" + "\n\nsettings.PathToPatcher: " +
                    settings.PathToPatcher + "\n\nArgument sent as path for update: " +
                    req.body.patchpath + "\n\nstdout: " + stdout);
            }
        });
    } else { // patcher path wasn't specified in input
        logger.warn('New patcher path was not specified in req.body');
        res.writeHead(500);
        res.end("No patchpath specified");
    }
    //and the error code 0 and 1 aren't really errors
}

// Give the requester what patchline this game server is on.
export function getCurrentPatchLine(req: express.Request, res: express.Response) {
	return res.json({patchline:settings.patchLine});
}

export function admin(req: express.Request, res: express.Response) {
    //res.writeHead(200);
    getStatusOfGameServers((err: any, results: any) => {
        if (err) return res.end(err.toString());
        for (let count in results) {
            results[count] = parseCommand(results[count]);
        }
        let gameServerJSONString = JSON.stringify(GameServer.getStatus(), null, 2);
        let publicPorts;
        if (settings.publicPorts) {
            publicPorts = JSON.stringify(settings.publicPorts);
        }
        res.render('admin', {
            PublicPort: process.env.PublicPort,
            DirectPort: process.env.DirectPort,
            commands: results,
            GameServer: gameServerJSONString,
            patchLine: settings.patchLine || '',
            queueURL: settings.queueURL || '',
            serverAddress: settings.serverAddress || '',
            publicPorts: publicPorts || '[]'
        });
        logger.info('admin status called', { codepath: 'GameServer.admin', commands: results, GameServer: gameServerJSONString});
    });
}

export function getGameServerData(req: express.Request, res: express.Response) {
	getStatusOfGameServers((err, results) => {
        if (err) return res.end(err.toString());
        for (let count in results) {
            results[count] = parseCommand(results[count]);
        }
		res.json(results);
    });
}

export function regexMatch(input: string, regex: any):Array<string> {
    return input.match(regex);
}

export function parseCommand(commandObject: any): any {
    let result: any = {};
    result.command = commandObject.command;
    let regex = /^.*server ([A-Za-z0-9]+)?.*game=([A-Za-z0-9\.]+)?.*MinPlayers=([0-9]+)?.*gameGUID=([A-Za-z0-9\-]+)?.*jobID=([A-Za-z0-9\-]+).*PORT=([0-9]+).* ([0-9]+)/;
    let regexResult = exports.regexMatch(result.command, regex);
    try {
        result.mapName = regexResult[1];
        result.gameType = regexResult[2];
        result.numOfPlayers = parseInt(regexResult[3]);
        result.gameGUID = regexResult[4];
        result.jobID = regexResult[5];
        result.port = parseInt(regexResult[6]);
        result.processId = parseInt(regexResult[7]);
        let slot: I.ServerSlot = GameServer.getSlotFromJobID(result.jobID);
        if (slot && slot.game) {
            result.activeHumanPlayerCount = slot.game.activeHumanPlayerCount;
        }
    } catch (error) {
        result.processId = commandObject.pid;
        result.jobID = commandObject.jobID;
        logger.error('regex failed to match', error);
    }

    return result;
}

export function killProcessManually(req: any, res: any) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    async.waterfall([
        async.apply(async.each, [req.query.pid], assertInputExists),
        (cb: any) => {
            proc.exec('taskkill /PID ' + req.query.pid + ' /F', (error, stdout, stderr) => {
                cb(error, stdout);
            });
        }
    ], (err: any, stdout: any) => {
            if (err) {
                logger.warn('Failed to kill a process', { codepath: "GameServer.killProcess", error: err, requestQuery: req.query, stdout: stdout, errorMessage: err.message });
                res.writeHead(500);
            }
            else {
                logger.info('Killed process succesfully', { codepath: "GameServer.killProcess", stdout: stdout });
            }
            res.end(stdout + "\n" + err);
        });
}
export function killJobManually(req: any, res: any) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    async.waterfall([
        async.apply(async.each, [req.query.jobID], assertInputExists),
        getStatusOfGameServers,
        (results: any[], next: any) => {
            results.forEach((value) => {
                if (value.jobID === req.query.jobID) {
                    proc.exec('taskkill /PID ' + value.pid + ' /F', (error, stdout, stderr) => {
                        if (error) {
                            res.writeHead(500);
                            logger.error("Failed to kill a process when there should have been one",
                                { codepath: "GameServer.killJob", error: error, value: value, query: req.query, results: results });
                        }
                    });
                }
            });
            next();
        }
    ], (err: any, stdout: any) => {
            if (err) {
                logger.warn('Failed to kill a process', { codepath: "GameServer.killProcess", error: err, requestQuery: req.query, stdout: stdout, errorMessage: err.message });
                res.writeHead(500);
            }
            else {
                logger.info('Killed process succesfully', { codepath: "GameServer.killProcess", stdout: stdout });
            }
            res.end(stdout + "\n" + err);
        });
}
//"C:\\games\\TheMaestros\\Game\\Binaries\\Win32\\UDK.exe server mapname?game=TheMaestrosGame.TMGameInfo?Dedicated?MinPlayers=2 -ConsolePosX=0 -ConsolePosY=0 PORT=12345 -forcelogflush -log=maestros_25000 -NOPAUSE 2300"
function getStatusOfGameServersFromProcessListing(commandLine: string): any[] {
    let results = [];
    let commands:Array<string> = commandLine.split("\r\r\n");
    for (let i = 0; i < commands.length; i++) {
        if (i != 0 && commands[i] !== '') {
            try {
                let jobID;
                let regex = /^.*jobID=([A-Za-z0-9\-]+)/;
                let regexResult = commands[i].match(regex);

                let regexPID = /([0-9]+)\s*$/;
                let regexPIDResult = commands[i].match(regexPID);
                if (regexResult) {
                    jobID = regexResult[1];
                } else {
                    jobID = regexPIDResult[1];
                }
                results.push({ "command": commands[i], "jobID": jobID, "pid": regexPIDResult[1] });
            } catch (e) {
                logger.warn('Failed to parse a gameserver command', { codepath: "GameServer.getStatusOfGameServersFromProcessListing", error: e, errorMessage: e.message, command: commands[i] });
            }
        }
    }
    return results;
}
function getStatusOfGameServers(callback: (err: Error, results: any[]) => void) {
    proc.exec('wmic process where name="' + settings.processFileName + '" get processid,commandline', (error, stdout, stderr) => {
        if (error) {
            logger.warn('status exec error', { codepath: "GameServer.getStatusOfGameServers", error: error, errorMessage: error.message });
            return callback(error, null);
        }
        let results;
        //try {
        results = getStatusOfGameServersFromProcessListing(stdout.toString());
        //} catch (e) {
        //    logger.warn('Failed to get GameServer Status', { codepath: "GameServer.status", error: e, errorMessage: e.message, stdout: stdout });
        //     return callback(e, null);
        // }
        return callback(null, results);
        //}
    });
}
//start /B UDK.exe server SkyIslandsGrayBox_AssetAlex??game=TheMaestrosGame.TMGameInfo?Dedicated?MinPlayers=2?gameGUID=123 -forcelogflush -log -ConsolePosX=0 -ConsolePosY=0 PORT=25000 -NOPAUSE -nullrhi
//NewGame?port=25000&mapName=SacredArena&gameType=TheMaestrosGame.TMGameInfo&playerCount=1&gameGUID=deadbeef-0340-8334-d34d-beefd34dbee4&jobID=deadbeef-0340-8334-d34d-beefd34dbee4
export function displayLog(req: express.Request, res: any) {
    async.waterfall([
        async.apply(async.each, [req.query.port], assertInputExists),
        (next: any) => {
            let file = fs.createReadStream(settings.dirToSearchForLogs + 'maestros_' + Number(req.query.port), { encoding: 'utf8' });
            file.on('error', next);
            file.on('end', next);
            file.on('data', (data: any) => {
                if (!res.headersSent) {
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                }
                res.write(data);
            });
        }
    ], (err: any) => {
            if (err) {
                if (!res.headersSent) {
                    res.writeHead(500);
                }
                logger.error('Error reading from log file', { codepath: "GameServer.displayLog", port: req.query.port, error: err, errorMessage: err.message });
                res.end("\n Error reading logfile: " + err);
            }
            else {
                res.end();
            }
        });
}

