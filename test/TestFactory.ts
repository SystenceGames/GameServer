import I = require('../Interfaces');
import Enums = require('../Enums');

export function buildServerSlot(): I.ServerSlot {
    let jobId: string = "fakeJobId";
    let processInfo: I.ProcessInfo = {activePlayerCount: 400, gameGUID: "fakeGameGUID", settings: { gameType: "fakeGameType", mapName: "fakeMapeName" } }
    let job: I.Job = { callbackURL: "http://example.org", jobID: jobId, processInfo: processInfo };
    let game: I.Game = { activeHumanPlayerCount: 100, jobId: jobId };
    let serverSlot: I.ServerSlot = { job: job, game: game, privatePort: 25000, publicPort: 25001, status: Enums.ServerSlotStatus.Started, timerForGameStartingTimeout: 200 }
    return serverSlot;
}