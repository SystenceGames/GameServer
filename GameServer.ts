import fs = require('fs');
import proc = require('child_process');
import request = require('request');
import Q = require('q');
let amqp = require('amqplib');
import async = require('async');
import Enums = require('./Enums');
import I = require('./Interfaces');
import settings = require('./config/settings');
let logger = require('./logger');

export interface ISortedSlots {
    occupied: { proc: I.ProcessStatus; slot: I.ServerSlot }[];
    openSlots: I.ServerSlot[];
    unAssociatedProcesses: I.ProcessStatus[]
}

export let serverSlots: I.ServerSlot[] = [];
export let isEnabled: boolean = false;
export let needsPatching: boolean = false;
export let isPatching = false;

export function initialize() {
    if (settings.patchLine && settings.queueURL && settings.serverAddress && settings.publicPorts) {
        enableAndConfigure(settings.patchLine, settings.queueURL, settings.serverAddress, settings.publicPorts);
    } else {
        logger.error("UnableToConfigureOnInit", new Error("settings were missing on init, and we could not enableAndConfigure"));
    }
    let inScheduler = false;
    setInterval(() => {
        if (!inScheduler) {
            inScheduler = true;
            _scheduler()
                .catch(_errorHandler)
                .finally(() => { inScheduler = false; })
                .done();
        }
    }, settings.schedulerFrequency);
}

//Triggered by timer
export function _scheduler(): Q.Promise<void> {
    //getLocalProcesses
    //compare to endpoints
    //foreachendpoint
    //  if free and not disabled no other polling, it polls
    //  if starting and we see something it is started, set kill timer, set to started
    //  if empty or polling or KillOnSight, but has process kill with EXTREMUM PREJUDICE
    // if KillOnSight and empty set to empty
    //doPatch! when all empty 
    //?if stuck in state dopatch with no procs for more than x time throw error, restart?
    //?if stuck in state starting???
    //Maybe add long timeouts to ever promsie chain...

    let aSlotIsPolling = (serverSlots.filter((slot) => { return (slot.status == Enums.ServerSlotStatus.Polling) }).length > 0);
    let aSlotIsStarting = false;

    return exports.getLocalProcesses()
        .then((processes: any) => {
            return exports._sortSlotsToProcesses(serverSlots, processes);
        })
        .then((sortedSlots: any) => {
            return Q
                .allSettled([
                    Q.allSettled(sortedSlots.unAssociatedProcesses.map(exports._killProcess)),
                    Q.allSettled(sortedSlots.openSlots.map(handleOpenSlot)),
                    Q.allSettled(sortedSlots.occupied.map(handleOccupiedSlot))
                ])
                .then(() => {
                    if (needsPatching && !isPatching && !aSlotIsPolling && !aSlotIsStarting && (sortedSlots.occupied.length == 0) && (sortedSlots.unAssociatedProcesses.length == 0)) {
                        return exports._doPatch();
                    }
                    else if (needsPatching) {
                        logger.info("didn't patch: ", {needsPatching: needsPatching, isPatching: isPatching, aSlotIsPolling: aSlotIsPolling, sortedSlotsOccupiedLength: sortedSlots.occupied.length, sortedSlotsUnassociatedProcessesLength: sortedSlots.unAssociatedProcesses.length});
                    }
                });
        })

    function handleOpenSlot(slot: I.ServerSlot): Q.Promise<{}> {
        switch (slot.status) {
            case Enums.ServerSlotStatus.Empty:
                if (!aSlotIsPolling && exports._shouldWeStartJobs()) {
                    aSlotIsPolling = true;
                    exports._startJobOnServerSlot(slot);
                }
                break;
            case Enums.ServerSlotStatus.KillOnSight:
            case Enums.ServerSlotStatus.Started:
                _transitionSlotToEmptyState(slot);
                break;
            case Enums.ServerSlotStatus.Starting:
                aSlotIsStarting = true;
                break;
            case Enums.ServerSlotStatus.Polling:
            //Do nothing, we already determine if a slot is polling above
            case Enums.ServerSlotStatus.Starting:
            default:
                break;
        }
        return;
    }
    function handleOccupiedSlot(tuple: { proc: I.ProcessStatus; slot: I.ServerSlot }): Q.Promise<{}> {
        let slot = tuple.slot;

        switch (slot.status) {
            case Enums.ServerSlotStatus.Empty:
            case Enums.ServerSlotStatus.KillOnSight:
            case Enums.ServerSlotStatus.Polling:
                return exports._killProcess(tuple.proc);
            case Enums.ServerSlotStatus.Starting:
            case Enums.ServerSlotStatus.Started:
            default:
                break;
        }
        return;
    }
}
function _errorHandler(err: Error): Q.Promise<{}> {
    logger.warn('Caught error in GameServer', { codepath: "GameServer._errorHandler", error: err, errorMessage: err.message, serverAddress: settings.serverAddress });
    return;
}
export function _sortSlotsToProcesses(slots: I.ServerSlot[], processes: I.ProcessStatus[]): ISortedSlots {
    let occupied: { proc: I.ProcessStatus; slot: I.ServerSlot }[] = [];
    let openSlots: I.ServerSlot[] = [];
    //add all slots to unAssocieated processes
    let unAssociatedProcesses: I.ProcessStatus[] = processes;

    //For each slot go through and only add it to openSlots if not found in processes
    openSlots = slots.filter((slot) => {
        let i;
        for (i = 0; i < unAssociatedProcesses.length; i++) {
            if (Number(unAssociatedProcesses[i].privatePort) == slot.privatePort) {
                occupied.push({ proc: unAssociatedProcesses.splice(i, 1)[0], slot: slot });
                return false;
            }
        }
        return true;
    });

    _cleanLeftoverGameData(openSlots);

    return { occupied: occupied, openSlots: openSlots, unAssociatedProcesses: unAssociatedProcesses };
};
function _cleanLeftoverGameData(openSlots: Array<I.ServerSlot>) {
    for (let i = 0; i < openSlots.length; i++) {
        if (openSlots[i].game) {
            delete openSlots[i].game;
        }
    }
}
export function getLocalProcesses(): Q.Promise<I.ProcessStatus[]> {
    return Q
        .ninvoke(proc, 'exec', 'wmic process where name="' + settings.processFileName + '" get processid,commandline')
        .then(String)
        .then(_parseLocalProcesses);
}
export function _parseLocalProcesses(psResult: string): I.ProcessStatus[] {
    let results: I.ProcessStatus[] = [];
    let commands = psResult.split("\r\r\n");
    let regexJobID = /^.*jobID=([A-Za-z0-9\-]+)/;
    let regexGameGUID = /^.*gameGUID=([A-Za-z0-9\-]+)/;
    let regexPrivatePort = /^.*PORT=([0-9]+)/;
    let regexPID = /([0-9]+)\s*$/;

    for (let i in commands) {
        if (commands[i] !== '' && commands[i] !== ',') {
            //We will split this in two parts so we always have information, even if the regex for port or gameguid fails
            try {
                //First we get a jobID / pid to be able to always kill on
                let jobID;
                let regexJobIDResult = commands[i].match(regexJobID);
                let regexPIDResult = commands[i].match(regexPID);

                if (regexJobIDResult) {
                    jobID = regexJobIDResult[1];
                } else {
                    jobID = regexPIDResult[1];
                }
                let partialResults: I.ProcessStatus = { "command": commands[i], "jobID": jobID, "pid": regexPIDResult[1] };

                //second we add the nonessential details
                try {
                    partialResults.gameGUID = commands[i].match(regexGameGUID)[1];
                    partialResults.privatePort = commands[i].match(regexPrivatePort)[1];
                } catch (e) {
                    logger.warn('Failed to parse a gameserver command for gameGUID or privatePort. This probably means theres an unauthorized udk.exe running', { codepath: "GameServer._parseLocalProcesses", error: e, errorMessage: e.message, command: commands[i], serverAddress: settings.serverAddress });
                }
                results.push(partialResults);
            } catch (e) {
                //If there is an error in parsing its not a valid process
            }
        }
    }
    return results;
}
export function _startJobOnServerSlot(serverSlot: I.ServerSlot) { //Specifically not a promise
    //set serverSlot status
    serverSlot.status = Enums.ServerSlotStatus.Polling;
    let jobID: any; //for logging
    //_pollForJob
    exports._pollForJob()
        .then((job: any) => {
            jobID = job.jobID;
            //change state to starting before calling start process
            serverSlot.status = Enums.ServerSlotStatus.Starting;
            serverSlot.job = job;
            exports._setTimerToKillWithEXTREMUMPREJUDICE(jobID);
            serverSlot.timerForGameStartingTimeout = _setTimerForGameStartingTimeout(serverSlot);

            //_startProcess
            logger.info('Game starting', { codepath: "GameServer._startJobOnServerSlot", jobID: jobID, serverAddress: settings.serverAddress, job: job, serverSlot: serverSlot });
            return exports._startProcess(job.processInfo, serverSlot.privatePort, job.jobID)
                .catch((err: any) => {
                    return _callbackConnectionInfoWithFailure(job.callbackURL).then(() => { throw err; }, (newerr) => { throw err; });//_callbackConnectionInfo with failure
                })
        })
        .catch((err: any) => { //Cleanup serverSlot status
            _transitionSlotToKillState(serverSlot);
            if (err.message == "Polling stopped") {
            } else {
                logger.error('Game failed to start', { codepath: "GameServer._startJobOnServerSlot", jobID: jobID, queueURL: settings.queueURL, jobQueueName: settings.jobQueueName, errorMessage: err.message, err: err });
            }
        })
        .done();
}
export function _pollForJob(): Q.Promise<I.Job> {
    return Q
        .fcall(() => {
            if (exports._shouldWeStartJobs()) return;
            else throw new Error("Polling stopped");
        })
        .then(_lookForJob)
        .then((result) => {
            if (result) return Q.resolve(result);
            else return Q.delay("", settings.jobPollingFrequency).then(_pollForJob);
        });
}
export function _lookForJob(): Q.Promise<I.Job> {
    return Q(amqp.connect(settings.queueURL))
        .then((connection) => {
            return Q(connection.createChannel())
                .then((channel: any) => {
                    channel.assertQueue(settings.jobQueueName, { durable: true });
                    return channel.get(settings.jobQueueName, { noAck: true })
                        .then((result: any) => {
                            channel.close();
                            return result;
                        });
                })
                .then((msg) => {
                    if (!msg) return null;
                    return JSON.parse(msg.content);
                })
                .finally(() => { connection.close(); });
        });
}

export function startServer(process: string, args: string) {
	let deferred = Q.defer();
	let server = proc.exec("start /D " + settings.processDir + " /B " + process + args, (error, stdout, stderr) => {
        if (error !== null) {
            logger.warn('game server exited with error before game started', { codepath: "GameServer.startServer", args: args });
            deferred.reject("game failed to start");
        } else {
            deferred.resolve({});
        }
    });
    return deferred;
}

export function _startProcess(processInfo: I.ProcessInfo, privatePort: number, jobID: string): Q.Promise<{}> {
	let process: string = settings.processDir + settings.processFileName + settings.processArg;
    let dashSettings: string = " -ConsolePosX=0 -ConsolePosY=0 PORT=" + String(privatePort) + " -forcelogflush -log=maestros_" + String(privatePort) + " -NOPAUSE -nullrhi -NOVERIFYGC";
    let botSettings: string = "?NumAIPlayers=" + processInfo.settings.aiPlayers.length;
    for (let i = 0; i < processInfo.settings.aiPlayers.length; i++) {
        botSettings += "?bot" + i + "Difficulty=" + processInfo.settings.aiPlayers[i].botDifficulty;
        botSettings += "?bot" + i + "PlayerName=" + processInfo.settings.aiPlayers[i].playerName;
        botSettings += "?bot" + i + "Ally=" + processInfo.settings.aiPlayers[i].allyId;
        botSettings += "?bot" + i + "CommanderName=" + processInfo.settings.aiPlayers[i].commanderName;
    }
    let args = " server " + processInfo.settings.mapName + "?game=" + processInfo.settings.gameType + "?Dedicated?MinPlayers=" + String(processInfo.activePlayerCount) + "?gameGUID=" + processInfo.gameGUID + "?jobID=" + jobID + "?nodeLocalPort=" + settings.httpPort + "?playerStatsMethod=" + settings.playerStatsMethod + botSettings + dashSettings;

    let deferred = exports.startServer(process, args);

    return deferred.promise;
}

export function gameStarted(jobID: string): Q.Promise<any> {
    logger.info("GameStarted received indication that a game has started", { codepath: "GameServer.gameStarted", jobID: jobID, serverAddress: settings.serverAddress, currentServerSlots: serverSlots });
    let slot = _getSlotFromJobID(jobID);
    if (slot && slot.job) {
        let job = slot.job; //since _transitionSlotToStartedState removes the job from the slot, since we no longer need it
        _transitionSlotToStartedState(slot);
        return _callbackConnectionInfo(job.callbackURL, slot);
    } else {
        return Q.reject();
    }
}

export function setActiveHumanPlayerCount(jobID: string, activeHumanPlayerCount: number) {
    let slot = _getSlotFromJobID(jobID);
    if (slot == null) {
        return;
    }
    if (slot.game == null) {
        return;
    }
    slot.game.activeHumanPlayerCount = activeHumanPlayerCount;
}

export function getSlotFromJobID(jobID: string): I.ServerSlot {
    return _getSlotFromJobID(jobID);
}

function _getSlotFromJobID(jobID: string): I.ServerSlot {
    let matchingSlots = exports.serverSlots.filter((slot: any) => {
        if (slot.job && (slot.job.jobID == jobID)) {
            return true; 
        }
        else if (slot.game && slot.game.jobId == jobID) {
            return true;
        }
        return false;
    });
    if (matchingSlots.length >= 1) {
        return matchingSlots[0];
    } else
        return null;
}

function _callbackConnectionInfo(callbackURL: string, endpoint: I.Endpoint): Q.Promise<{}> {
    let connectionInfo: I.ConnectionInfo = { publicPort: endpoint.publicPort, serverHostName: settings.serverAddress };
    return _callbackToURLWith(connectionInfo, callbackURL);
}
function _callbackConnectionInfoWithFailure(callbackURL: string): Q.Promise<{}> {
    return _callbackToURLWith({ Failure: "Game Failed to start" }, callbackURL);
}
function _callbackToURLWith(result: any, callbackURL: any): Q.Promise<{}> {
    return Q.Promise((resolve: (val: {}) => void, reject: any) => {
        request.post(callbackURL, { timeout: 20 * 1000, json: result, time: true }, (err: any, res: any, body: any) => {
            logger.info("OutboundCall", { url: callbackURL, durationMs: res.elapsedTime, statusCode: res.statusCode });
            if (err) {
                logger.error("Couldn't callback to URL it failed with error in GameServer._callbackToURLWith", { err: err });
                reject(new Error("Couldn't callback to URL it failed with error" + JSON.stringify(err)));
            }
            else if (!res) {
                logger.error("Did not receive a response from " + callbackURL, { codepath: "GameServer._callbackToURLWith", callbackURL: callbackURL, serverAddress: settings.serverAddress });
                reject(new Error("Couldn't callback to URL it failed with error"));
            } else if (res.statusCode != 200) {
                logger.info("Callback rejected, killing game", { codepath: "GameServer._callbackToURLWith", callbackURL: callbackURL, statusCode: res.statusCode, result: result, serverAddress: settings.serverAddress });
                reject(new Error("Couldn't callback to URL. It failed with response code " + res.statusCode));
            }
            resolve('');
        });
    });
}

export function _setTimerToKillWithEXTREMUMPREJUDICE(jobID: string) {
    setTimeout(() => {
        _killJob(jobID)
            .catch((err) => {throw new Error("NYI") })
            .done();
    }, settings.terminateWithEXTREMUMPREJUDICEAfter);
}
export function _setTimerForGameStartingTimeout(slot: I.ServerSlot): number {
    let timer: any = setTimeout(() => {
        _transitionSlotToKillState(slot);
        if (slot.job && slot.job.callbackURL) {
            _callbackConnectionInfoWithFailure(slot.job.callbackURL)
                .catch((err) => {/*Swallow error*/ })
                .done();
        }
    }, settings.HowLongToWaitForGameToStart);
    //So that logging does not throw up so hard
    timer.toJSON = function () {
        return "Timer Set";
    }
    return timer;
}
function _transitionSlotToEmptyState(slot: I.ServerSlot) {
    slot.status = Enums.ServerSlotStatus.Empty;
    if (slot.game) {
        delete slot.game;
    }
}
function _transitionSlotToKillState(slot: I.ServerSlot) {
    slot.status = Enums.ServerSlotStatus.KillOnSight;
    if (slot.game) {
        delete slot.game;
    }
    _transitionSlotHelper(slot);
}
function _transitionSlotToStartedState(slot: I.ServerSlot) {
    slot.status = Enums.ServerSlotStatus.Started;
    let game: I.Game = {
        activeHumanPlayerCount: 0,
        jobId: slot.job.jobID
    }
    slot.game = game;
    _transitionSlotHelper(slot);
}
function _transitionSlotHelper(slot: I.ServerSlot) {
    delete slot.job;
    if (slot.timerForGameStartingTimeout) {
        clearTimeout(slot.timerForGameStartingTimeout);
    }
    delete slot.timerForGameStartingTimeout;
}

export function _killJob(jobID: any): Q.Promise<{}[]> {
    return getLocalProcesses()
        .then((procs: I.ProcessStatus[]) => {
            let promises: Q.Promise<{}>[] = [];
            procs.forEach((procStatus) => {
                if (procStatus.jobID == jobID) {
                    promises.push(_killProcess(procStatus));
                }
            })
            return Q.all(promises);
        });

}
export function _killProcess(processStatus: I.ProcessStatus): Q.Promise<{}> {
    logger.info("Killing process", { codepath: "GameServer._killProcess", serverAddress: settings.serverAddress, jobID: processStatus.jobID, gameGUID: processStatus.gameGUID, processStatus: processStatus });
    return Q.ninvoke(proc, 'exec', 'taskkill /PID ' + processStatus.pid + ' /F');
}
export function _doPatch(): Q.Promise<void> {
    isPatching = true;
    logger.info("Patching...");
    let patchURL = settings.patchingBasePath + settings.patchLine + '/';
    return Q.ninvoke(proc, 'execFile', settings.PathToPatcher, [patchURL], {})
        .then(() => {
            needsPatching = false;
            logger.info("Patching successful", { codepath: "GameServer._doPatch", serverAddress: settings.serverAddress, patchURL: patchURL });
            return;
        }).catch((reason: any) => {
            logger.error("Patching unsucessful", { codepath: "GameServer._doPatch", reason });
            return;
        })
        .finally(() => {
            isPatching = false;
            return;
        });

}
export function _updateServerSlots(publicPorts: number[]) {
    //Tag all slots so we know which ones aren't new later
    serverSlots.forEach((slot) => {
        slot.tagged = true;
    });

    //Update or add any server slots in publicPorts
    publicPorts.forEach((publicPort) => {
        let privatePort = _privatePortFromPublicPort(publicPort);
        //Find the existing serverSlot
        let foundSlot: I.ServerSlot;
        serverSlots.forEach((slot) => {
            if (slot.privatePort == privatePort) {
                foundSlot = slot;
            }
        })
        //Update it if found
        if (foundSlot) {
            foundSlot.publicPort = publicPort;
            foundSlot.tagged = false;
        } else { //Create it if it doesn't exist
            serverSlots.push({ publicPort: publicPort, privatePort: privatePort, status: Enums.ServerSlotStatus.Started });
        }
    })

    //remove from serverSlots any server slots not in new list
    serverSlots = serverSlots.filter((serverSlot) => {
        //only return items that are not tagged
        return !serverSlot.tagged;
    })
}

export function patchNeeded() {
    needsPatching = true;
}
export function enableAndConfigure(patchLine: string, newQueueURL: string, newServerAddress: string, publicPorts: number[]) {
    settings.patchLine = patchLine;
    settings.queueURL = newQueueURL;
    settings.serverAddress = newServerAddress;
    settings.publicPorts = publicPorts;
    settings.save().done();

    patchNeeded();
    _updateServerSlots(publicPorts);

    isEnabled = true;
}
export function disable() {
    isEnabled = false;
}

export function getStatus(): I.GameServerStatus {
    return { isEnabled: isEnabled, needsPatching: needsPatching, isPatching: isPatching, slots: serverSlots, settings: settings };
}

export function _shouldWeStartJobs(): boolean {
    //We should stop polling if we are disabled or if we need patching
    return isEnabled && !needsPatching;
}
export function _privatePortFromPublicPort(port: any): number {
    port = Number(port);
    return 25000 + (port % 100);
}
