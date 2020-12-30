import Q = require('q');
import should = require('should');
require('should');
import sinon = require('sinon');
import GameServer = require('../GameServer');
import Enums = require('../Enums');
import I = require('../Interfaces');
import settings = require('../config/settings');
import TestFactory = require('./TestFactory');
import request = require('request');

beforeEach(function () {
    settings.patchLine = "release";
    settings.publicPorts = [25000, 25001, 25002];
    settings.queueURL = "http://example.org/";
    settings.serverAddress = 'example.org';
});

describe("GameServer general tests:", function () {
    let serverSlot: I.ServerSlot;
    let serverSlotJobId: string;
    let sandbox: any;
    let requestPostStub: any;
    let getSlotFromJobIDStub: any;
    let bigRequest: any = {};

    beforeEach(function () {
        serverSlot = TestFactory.buildServerSlot();
        serverSlotJobId = serverSlot.job.jobID;
        GameServer.serverSlots.push(serverSlot);
        sandbox = sinon.sandbox.create();
    });

    it("update active human player count", function () {
        let activeHumanPlayerCount: number = 100;

        GameServer.setActiveHumanPlayerCount(serverSlotJobId, activeHumanPlayerCount);
        
        serverSlot.game.activeHumanPlayerCount.should.equal(100);
    });

    it("1. gameStarted", function () {
        requestPostStub = sandbox.stub(request, "post").callsArgWithAsync(2, null, { statusCode: 200 }, {});
        
        let result: Q.Promise<any> = GameServer.gameStarted(serverSlotJobId).then(() => {
            sinon.assert.called(requestPostStub);
        }).catch((err: any) => {
            should.equal(true, false, "Should have not errored");
        });
        
        serverSlot.status.should.equal(Enums.ServerSlotStatus.Started);
        should.equal(serverSlot.job, null);
        should.equal(serverSlot.game.activeHumanPlayerCount, 0);
        should.equal(serverSlot.game.jobId, serverSlotJobId);
        should.equal(serverSlot.timerForGameStartingTimeout, null);

        return result;
    });

    it("2. gameStartedWithNoSlot", function () {
        let nonexistantJobId: string = "nonexistantJobId";
        let result: Q.Promise<{}> = GameServer.gameStarted(nonexistantJobId);
        should.equal(result.isRejected(), true);
    });

    it("3. gameStartedWithInvalidURI", function () {
        serverSlot.job.callbackURL = "invalidUrl";
        let result: Q.Promise<{}> = GameServer.gameStarted(serverSlot.job.jobID);
        should.equal(result.isRejected(), true);
    });

    it("4. gameStartedWithEmptyResponse", function (done: any) {
        requestPostStub = sandbox.stub(request, "post").callsArgWithAsync(2, null, { elapsedTime: 10 }, {});

        let result: Q.Promise<any> = GameServer.gameStarted(serverSlot.job.jobID).then(() => {
            done(new Error("should have errored out"));
        }).catch((err: any) => {
            done();
        });
    });

    it("converting privateport to public", function () {
        let publicPorts = [25000, "25000", "38504", 29999, 1, 26000, 25005];
        let privatPorts = [25000, 25000, 25004, 25099, 25001, 25000, 25005];
        for (let i in publicPorts) {
            GameServer._privatePortFromPublicPort(publicPorts[i]).should.equal(privatPorts[i]);
        }
    });
    it("Update or add Endpoint", function () {
        let inputList1 = [26000, 26001, 25002]
        GameServer._updateServerSlots(inputList1);

        GameServer.serverSlots[0].status.should.equal(Enums.ServerSlotStatus.Started);
        GameServer.serverSlots[0].publicPort.should.equal(inputList1[0]);
        GameServer.serverSlots[0].privatePort.should.equal(25000);

        GameServer.serverSlots[1].publicPort.should.equal(inputList1[1]);
        GameServer.serverSlots[1].privatePort.should.equal(25001);

        GameServer.serverSlots[0].status = Enums.ServerSlotStatus.Empty;
        GameServer.serverSlots[1].status = Enums.ServerSlotStatus.Polling;

        let inputList2 = [27000, 26003, 26001];
        GameServer._updateServerSlots(inputList2);
        GameServer.serverSlots.length.should.equal(3);
        GameServer.serverSlots[0].publicPort.should.equal(inputList2[0]);
        GameServer.serverSlots[0].privatePort.should.equal(25000);
        GameServer.serverSlots[0].status.should.equal(Enums.ServerSlotStatus.Empty);

        GameServer.serverSlots[1].publicPort.should.equal(inputList2[2]);
        GameServer.serverSlots[1].privatePort.should.equal(25001);
        GameServer.serverSlots[1].status.should.equal(Enums.ServerSlotStatus.Polling);

        GameServer.serverSlots[2].publicPort.should.equal(inputList2[1]);
        GameServer.serverSlots[2].privatePort.should.equal(25003);


    });
    it.skip("MANUAL: _pollForJob", () => {
        GameServer.isEnabled = true;
        GameServer.needsPatching = false;
        return GameServer._pollForJob().then(console.log);
    });
    it("test _startJobOnServerSlot");

    it("", () => {
        GameServer._setTimerToKillWithEXTREMUMPREJUDICE("");
    });

    afterEach(() => {
        GameServer.serverSlots = [];
        sandbox.restore();
    });

});

describe("GameServer", function () {
    let process0: I.ProcessStatus;
    let process1: I.ProcessStatus;
    let process2: I.ProcessStatus;
    let process0clone: I.ProcessStatus;
    let emptySlot0: I.ServerSlot;
    let emptySlot1: I.ServerSlot;
    let startedSlot0: I.ServerSlot;
    let startedSlot1: I.ServerSlot;
    let sandbox: any;
    let spyStartJob: any;
    let spySetKillTimer: any;
    let spyKillProcess: any;
    let spyDoPatch: any;

    beforeEach(() => {
        sandbox = sinon.sandbox.create();
        GameServer.serverSlots = [];
        GameServer.isEnabled = true;
        GameServer.needsPatching = false;
        GameServer.isPatching = false;

        process0 = { gameGUID: "0gameGUID-deadbeef", jobID: "0som3-jobID", pid: '100', privatePort: "25000" };
        process1 = { gameGUID: "1gameGUID-deadbeef", jobID: "1som3-jobID", pid: '111', privatePort: "25001" };
        process2 = { gameGUID: "2gameGUID-deadbeef", jobID: "2som3-jobID", pid: '122', privatePort: "25002" };
        process0clone = { gameGUID: "0gameGUID-deadbeef", jobID: "0som3-jobID", pid: '101', privatePort: "25000" };
        emptySlot0 = { publicPort: 26000, privatePort: 25000, status: Enums.ServerSlotStatus.Empty };
        emptySlot1 = { publicPort: 26001, privatePort: 25001, status: Enums.ServerSlotStatus.Empty };
        startedSlot0 = { publicPort: 26000, privatePort: 25000, status: Enums.ServerSlotStatus.Started };
        startedSlot1 = { publicPort: 26001, privatePort: 25001, status: Enums.ServerSlotStatus.Started };

        spyStartJob = sandbox.stub(GameServer, '_startJobOnServerSlot');
        spySetKillTimer = sandbox.stub(GameServer, '_setTimerToKillWithEXTREMUMPREJUDICE').returns({});
        spyKillProcess = sandbox.stub(GameServer, '_killProcess').returns(Q.resolve({}));
        spyDoPatch = sandbox.stub(GameServer, '_doPatch').returns(Q.resolve({}));
    });
    describe("sort: ", function () {
        it("slots: 0, procs: 0", function () {
            let result = GameServer._sortSlotsToProcesses([], []);
            result.should.eql({
                occupied: [], openSlots: [], unAssociatedProcesses: []
            });
        });
        it("slots: 1 empty, procs: none", function () {
            let result = GameServer._sortSlotsToProcesses([emptySlot0], []);
            result.should.eql({
                occupied: [], openSlots: [emptySlot0], unAssociatedProcesses: []
            });
        });
        it("slots: none, procs: 1 ", function () {
            let result = GameServer._sortSlotsToProcesses([], [process0]);
            result.should.eql({
                occupied: [], openSlots: [], unAssociatedProcesses: [process0]
            });
        });
        it("slots: 1, procs: 1 on slot", function () {
            let result = GameServer._sortSlotsToProcesses([emptySlot0], [process0]);
            result.should.eql({
                occupied: [{ proc: process0, slot: emptySlot0 }], openSlots: [], unAssociatedProcesses: []
            });
        });
        it("slots: 2, procs: 1 on slot", function () {
            let result = GameServer._sortSlotsToProcesses([emptySlot0, emptySlot1], [process0]);
            result.should.eql({
                occupied: [{ proc: process0, slot: emptySlot0 }], openSlots: [emptySlot1], unAssociatedProcesses: []
            });
        });
        it("slots: 2, procs: 1 on slot, 1 bad", function () {
            let result = GameServer._sortSlotsToProcesses([emptySlot0, emptySlot1], [process0, process2]);
            result.should.eql({
                occupied: [{ proc: process0, slot: emptySlot0 }], openSlots: [emptySlot1], unAssociatedProcesses: [process2]
            });
        });
        it("slots: 2, procs: 2 on slot, 1 bad, 1 on same slot", function () {
            let result = GameServer._sortSlotsToProcesses([emptySlot0, emptySlot1], [process0, process1, process2, process0clone]);
            result.should.eql({
                occupied: [{ proc: process0, slot: emptySlot0 }, { proc: process1, slot: emptySlot1 }], openSlots: [], unAssociatedProcesses: [process2, process0clone]
            });
        });
        it("slots: 2, procs:1 bad", function () {
            let result = GameServer._sortSlotsToProcesses([emptySlot0, emptySlot1], [process2]);
            result.should.eql({
                occupied: [], openSlots: [emptySlot0, emptySlot1], unAssociatedProcesses: [process2]
            });
        });
    });

    describe("Scheduler with", function () {
        it("two empty slots, nothing found", function () {
            GameServer.serverSlots = [emptySlot0, emptySlot1];
            sandbox.stub(GameServer, 'getLocalProcesses').returns(Q.resolve([]));

            return GameServer._scheduler().then(() => {

                GameServer.serverSlots[0].status.should.equal(Enums.ServerSlotStatus.Empty);
                GameServer.serverSlots[1].status.should.equal(Enums.ServerSlotStatus.Empty);
                sinon.assert.calledOnce(spyStartJob);
                sinon.assert.notCalled(spySetKillTimer);
                sinon.assert.notCalled(spyKillProcess);
                sinon.assert.notCalled(spyDoPatch);

            });
        });
        it("slots(empty, polling), nothing found", function () {
            emptySlot1.status = Enums.ServerSlotStatus.Polling;
            GameServer.serverSlots = [emptySlot0, emptySlot1];
            sandbox.stub(GameServer, 'getLocalProcesses').returns(Q.resolve([]));

            return GameServer._scheduler().then(() => {

                GameServer.serverSlots[0].status.should.equal(Enums.ServerSlotStatus.Empty);
                GameServer.serverSlots[1].status.should.equal(Enums.ServerSlotStatus.Polling);
                sinon.assert.notCalled(spyStartJob);
                sinon.assert.notCalled(spySetKillTimer);
                sinon.assert.notCalled(spyKillProcess);
                sinon.assert.notCalled(spyDoPatch);

            });
        });
        it("no slots, stray found", function () {
            GameServer.serverSlots = [];
            sandbox.stub(GameServer, 'getLocalProcesses').returns(Q.resolve([process2]));

            return GameServer._scheduler().then(() => {

                sinon.assert.notCalled(spyStartJob);
                sinon.assert.notCalled(spySetKillTimer);
                sinon.assert.calledOnce(spyKillProcess);
                sinon.assert.calledWith(spyKillProcess, process2);
                sinon.assert.notCalled(spyDoPatch);
            });
        });
        it("nothing running, three found", function () {
            GameServer.serverSlots = [emptySlot0, emptySlot1];
            sandbox.stub(GameServer, 'getLocalProcesses').returns(Q.resolve([process0, process1, process2]));

            return GameServer._scheduler().then(() => {

                GameServer.serverSlots.length.should.equal(2);
                GameServer.serverSlots[0].status.should.equal(Enums.ServerSlotStatus.Empty);
                GameServer.serverSlots[1].status.should.equal(Enums.ServerSlotStatus.Empty);
                sinon.assert.notCalled(spyStartJob);
                sinon.assert.notCalled(spySetKillTimer);
                sinon.assert.calledThrice(spyKillProcess);
                sinon.assert.calledWith(spyKillProcess, process0);
                sinon.assert.calledWith(spyKillProcess, process1);
                sinon.assert.calledWith(spyKillProcess, process2);
                sinon.assert.notCalled(spyDoPatch);
            });
        });
        it("two running, nothing found, needspatching", function () {
            GameServer.needsPatching = true;
            GameServer.serverSlots = [startedSlot0, startedSlot1];
            sandbox.stub(GameServer, 'getLocalProcesses').returns(Q.resolve([]));

            return GameServer._scheduler().then(() => {

                GameServer.serverSlots[0].status.should.equal(Enums.ServerSlotStatus.Empty);
                GameServer.serverSlots[1].status.should.equal(Enums.ServerSlotStatus.Empty);
                sinon.assert.notCalled(spyStartJob);
                sinon.assert.notCalled(spySetKillTimer);
                sinon.assert.notCalled(spyKillProcess);
                sinon.assert.calledOnce(spyDoPatch); //should patch if only slots show stuffs
            });
        });
        it("slots(started), two found on same port", function () {
            GameServer.serverSlots = [startedSlot0];
            sandbox.stub(GameServer, 'getLocalProcesses').returns(Q.resolve([process0, process0clone]));

            return GameServer._scheduler().then(() => {

                GameServer.serverSlots[0].status.should.equal(Enums.ServerSlotStatus.Started);
                sinon.assert.notCalled(spyStartJob);
                sinon.assert.notCalled(spySetKillTimer);
                sinon.assert.calledOnce(spyKillProcess);
                sinon.assert.calledWith(spyKillProcess, process0clone);
                sinon.assert.notCalled(spyDoPatch);
            });
        });
        it("slots(polling, KillOnSight), two found", function () {
            emptySlot0.status = Enums.ServerSlotStatus.Polling;
            emptySlot1.status = Enums.ServerSlotStatus.KillOnSight;
            GameServer.serverSlots = [emptySlot0, emptySlot1];
            sandbox.stub(GameServer, 'getLocalProcesses').returns(Q.resolve([process0, process1]));

            return GameServer._scheduler().then(() => {

                GameServer.serverSlots[0].status.should.equal(Enums.ServerSlotStatus.Polling);
                GameServer.serverSlots[1].status.should.equal(Enums.ServerSlotStatus.KillOnSight); //it kills it so the slots should stay killonsight
                sinon.assert.notCalled(spyStartJob);
                sinon.assert.notCalled(spySetKillTimer);
                sinon.assert.calledTwice(spyKillProcess);
                sinon.assert.calledWith(spyKillProcess, process0);
                sinon.assert.calledWith(spyKillProcess, process1);
                sinon.assert.notCalled(spyDoPatch);
            });
        });
        it("one starting, one found", function () {
            emptySlot0.status = Enums.ServerSlotStatus.Starting
            GameServer.serverSlots = [emptySlot0, emptySlot1];
            sandbox.stub(GameServer, 'getLocalProcesses').returns(Q.resolve([process0]));
            spyStartJob.restore();
            spyStartJob = sandbox.spy(GameServer, '_startJobOnServerSlot');
            let spyStartProcess: any = sandbox.stub(GameServer, '_startProcess').returns(Q.resolve({}));
            let spyShouldWeStartJobs: any = sandbox.stub(GameServer, '_shouldWeStartJobs').returns(true);
            let fakeJob: I.Job = {
                jobID: process0.jobID, processInfo: {
                    settings: { mapName: "fakeMapName", gameType: "fakeGameType" },
                    activePlayerCount: 2,
                    gameGUID: "fakeGameGuid"
                },
                callbackURL: "fakeCallbackUrl"
            };
            let spyPollForJob: any = sandbox.stub(GameServer, '_pollForJob').returns(Q.resolve(fakeJob));

            return GameServer._scheduler().then(() => {

                GameServer.serverSlots[0].status.should.equal(Enums.ServerSlotStatus.Starting);
                sinon.assert.calledOnce(spyStartJob);
                GameServer.serverSlots[1].status.should.equal(Enums.ServerSlotStatus.Starting);
                sinon.assert.calledWith(spyStartJob, emptySlot1);
                sinon.assert.calledOnce(spySetKillTimer);
                sinon.assert.calledWith(spySetKillTimer, process0.jobID);
                sinon.assert.notCalled(spyKillProcess);
                sinon.assert.notCalled(spyDoPatch);
            });
        });
        it("no slots, stray found, needsPatching", function () {
            GameServer.needsPatching = true;
            GameServer.serverSlots = [];
            sandbox.stub(GameServer, 'getLocalProcesses').returns(Q.resolve([process2]));

            return GameServer._scheduler().then(() => {

                sinon.assert.notCalled(spyStartJob);
                sinon.assert.notCalled(spySetKillTimer);
                sinon.assert.calledOnce(spyKillProcess);
                sinon.assert.calledWith(spyKillProcess, process2);
                sinon.assert.notCalled(spyDoPatch);
            });
        });
        it("slots empty, no found, needsPatching", function () {
            GameServer.needsPatching = true;
            GameServer.serverSlots = [emptySlot0, emptySlot1];
            sandbox.stub(GameServer, 'getLocalProcesses').returns(Q.resolve([]));

            return GameServer._scheduler().then(() => {
                sinon.assert.notCalled(spyStartJob);
                sinon.assert.notCalled(spySetKillTimer);
                sinon.assert.notCalled(spyKillProcess);
                sinon.assert.calledOnce(spyDoPatch);
            })

        });
        it("slots empty, one found, needsPatching", function () {
            GameServer.needsPatching = true;
            GameServer.serverSlots = [emptySlot0, emptySlot1];
            sandbox.stub(GameServer, 'getLocalProcesses').returns(Q.resolve([process0]));

            return GameServer._scheduler().then(() => {

                GameServer.serverSlots[0].status.should.equal(Enums.ServerSlotStatus.Empty);
                GameServer.serverSlots[1].status.should.equal(Enums.ServerSlotStatus.Empty);
                sinon.assert.notCalled(spyStartJob);
                sinon.assert.notCalled(spySetKillTimer);
                sinon.assert.calledOnce(spyKillProcess);
                sinon.assert.calledWith(spyKillProcess, process0);
                sinon.assert.notCalled(spyDoPatch); //should not patch
            });
        });
        it("slot polling, none, needsPatching", function () {
            GameServer.needsPatching = true;
            emptySlot0.status = Enums.ServerSlotStatus.Polling;
            GameServer.serverSlots = [emptySlot0, emptySlot1];
            sandbox.stub(GameServer, 'getLocalProcesses').returns(Q.resolve([]));

            return GameServer._scheduler().then(() => {

                GameServer.serverSlots[0].status.should.equal(Enums.ServerSlotStatus.Polling);
                GameServer.serverSlots[1].status.should.equal(Enums.ServerSlotStatus.Empty);
                sinon.assert.notCalled(spyStartJob);
                sinon.assert.notCalled(spySetKillTimer);
                sinon.assert.notCalled(spyKillProcess);
                sinon.assert.notCalled(spyDoPatch); //should not patch
            });
        });
        it("slot starting, none, needsPatching", function () {
            GameServer.needsPatching = true;
            emptySlot0.status = Enums.ServerSlotStatus.Starting;
            GameServer.serverSlots = [emptySlot0, emptySlot1];
            sandbox.stub(GameServer, 'getLocalProcesses').returns(Q.resolve([]));

            return GameServer._scheduler().then(() => {

                GameServer.serverSlots[0].status.should.equal(Enums.ServerSlotStatus.Starting);
                GameServer.serverSlots[1].status.should.equal(Enums.ServerSlotStatus.Empty);
                sinon.assert.notCalled(spyStartJob);
                sinon.assert.notCalled(spySetKillTimer);
                sinon.assert.notCalled(spyKillProcess);
                sinon.assert.notCalled(spyDoPatch); //should not patch
            });
        });
        it("slots(empty), none, needsPatching, ispatching", function () {
            GameServer.needsPatching = true;
            GameServer.isPatching = true;
            GameServer.serverSlots = [emptySlot0, emptySlot1];
            sandbox.stub(GameServer, 'getLocalProcesses').returns(Q.resolve([]));

            return GameServer._scheduler().then(() => {

                GameServer.serverSlots[0].status.should.equal(Enums.ServerSlotStatus.Empty);
                GameServer.serverSlots[1].status.should.equal(Enums.ServerSlotStatus.Empty);
                sinon.assert.notCalled(spyStartJob);
                sinon.assert.notCalled(spySetKillTimer);
                sinon.assert.notCalled(spyKillProcess);
                sinon.assert.notCalled(spyDoPatch); //should not patch
            });
        });
    });
    afterEach(() => {
        sandbox.restore();
    });
});

describe('GameServer process listing tests: ', function () {
    let noUDKRunning: any;
    let oneUDKRunningWithoutMetaData: any;
    let oneUDKRunningWithMetaData: any;
    let twoUDKRunningWithMetaData: any;
    beforeEach(function () {
        //All of this is neccesary so that we don't lose the exact windows encoding of newlines. We can't just input a string from comments :(
        function bufferAsJSONToString(input: any) {
            return new Buffer(JSON.parse(input)).toString();
        }
        oneUDKRunningWithoutMetaData = bufferAsJSONToString(
            "[67, 111, 109, 109, 97, 110, 100, 76, 105, 110, 101, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 80, 114, 111, 99, 101, 115, 115, 73, 100, 32, 32, 13, 13, 10, 34, 67, 58, 92, 80, 114, 111, 103, 114, 97, 109, 32, 70, 105, 108, 101, 115, 32, 40, 120, 56, 54, 41, 92, 84, 104, 101, 32, 77, 97, 101, 115, 116, 114, 111, 115, 92, 71, 97, 109, 101, 92, 66, 105, 110, 97, 114, 105, 101, 115, 92, 87, 105, 110, 51, 50, 92, 85, 68, 75, 46, 101, 120, 101, 34, 32, 45, 108, 111, 103, 32, 45, 119, 105, 110, 100, 111, 119, 101, 100, 32, 45, 86, 83, 121, 110, 99, 32, 32, 53, 57, 48, 52, 32, 32, 32, 32, 32, 32, 32, 13, 13, 10, 13, 13, 10, 44]"
            );
        noUDKRunning = bufferAsJSONToString(
            '[13, 13, 10, 13, 13, 10, 44, 78, 111, 32, 73, 110, 115, 116, 97, 110, 99, 101, 40, 115, 41, 32, 65, 118, 97, 105, 108, 97, 98, 108, 101, 46, 13, 13, 10]'
            );
        oneUDKRunningWithMetaData = bufferAsJSONToString(
            '[67, 111, 109, 109, 97, 110, 100, 76, 105, 110, 101, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 80, 114, 111, 99, 101, 115, 115, 73, 100, 32, 32, 13, 13, 10, 34, 67, 58, 92, 103, 97, 109, 101, 115, 92, 84, 104, 101, 77, 97, 101, 115, 116, 114, 111, 115, 92, 71, 97, 109, 101, 92, 66, 105, 110, 97, 114, 105, 101, 115, 92, 87, 105, 110, 51, 50, 92, 85, 68, 75, 46, 101, 120, 101, 34, 32, 115, 101, 114, 118, 101, 114, 32, 83, 97, 99, 114, 101, 100, 65, 114, 101, 110, 97, 63, 103, 97, 109, 101, 61, 84, 104, 101, 77, 97, 101, 115, 116, 114, 111, 115, 71, 97, 109, 101, 46, 84, 77, 71, 97, 109, 101, 73, 110, 102, 111, 63, 68, 101, 100, 105, 99, 97, 116, 101, 100, 63, 77, 105, 110, 80, 108, 97, 121, 101, 114, 115, 61, 49, 63, 103, 97, 109, 101, 71, 85, 73, 68, 61, 100, 101, 97, 100, 98, 101, 101, 102, 45, 49, 50, 51, 52, 45, 56, 51, 51, 52, 45, 100, 51, 52, 100, 45, 98, 101, 101, 102, 100, 51, 52, 100, 98, 101, 101, 52, 63, 106, 111, 98, 73, 68, 61, 100, 101, 97, 100, 98, 101, 101, 102, 45, 48, 51, 52, 48, 45, 56, 51, 51, 52, 45, 100, 51, 52, 100, 45, 98, 101, 101, 102, 100, 51, 52, 100, 98, 101, 101, 52, 32, 45, 67, 111, 110, 115, 111, 108, 101, 80, 111, 115, 88, 61, 48, 32, 45, 67, 111, 110, 115, 111, 108, 101, 80, 111, 115, 89, 61, 48, 32, 80, 79, 82, 84, 61, 50, 53, 48, 48, 48, 32, 45, 108, 111, 103, 61, 109, 97, 101, 115, 116, 114, 111, 115, 95, 50, 53, 48, 48, 48, 32, 45, 78, 79, 80, 65, 85, 83, 69, 32, 45, 110, 117, 108, 108, 114, 104, 105, 32, 32, 53, 54, 52, 52, 32, 32, 32, 32, 32, 32, 32, 13, 13, 10, 13, 13, 10, 44]'
            );
        twoUDKRunningWithMetaData = bufferAsJSONToString(
            '[67,111,109,109,97,110,100,76,105,110,101,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,80,114,111,99,101,115,115,73,100,32,32,13,13,10,34,67,58,92,103,97,109,101,115,92,84,104,101,77,97,101,115,116,114,111,115,92,71,97,109,101,92,66,105,110,97,114,105,101,115,92,87,105,110,51,50,92,85,68,75,46,101,120,101,34,32,115,101,114,118,101,114,32,83,97,99,114,101,100,65,114,101,110,97,63,103,97,109,101,61,84,104,101,77,97,101,115,116,114,111,115,71,97,109,101,46,84,77,71,97,109,101,73,110,102,111,63,68,101,100,105,99,97,116,101,100,63,77,105,110,80,108,97,121,101,114,115,61,49,63,103,97,109,101,71,85,73,68,61,100,101,97,100,98,101,101,102,45,50,50,50,50,45,56,51,51,52,45,100,51,52,100,45,98,101,101,102,100,51,52,100,98,101,101,52,63,106,111,98,73,68,61,100,101,97,100,98,101,101,102,45,50,50,51,52,45,56,51,51,52,45,100,51,52,100,45,98,101,101,102,100,51,52,100,98,101,101,52,32,45,67,111,110,115,111,108,101,80,111,115,88,61,48,32,45,67,111,110,115,111,108,101,80,111,115,89,61,48,32,80,79,82,84,61,50,53,48,48,49,32,45,108,111,103,61,109,97,101,115,116,114,111,115,95,50,53,48,48,49,32,45,78,79,80,65,85,83,69,32,45,110,117,108,108,114,104,105,32,32,51,51,48,56,32,32,32,32,32,32,32,13,13,10,34,67,58,92,103,97,109,101,115,92,84,104,101,77,97,101,115,116,114,111,115,92,71,97,109,101,92,66,105,110,97,114,105,101,115,92,87,105,110,51,50,92,85,68,75,46,101,120,101,34,32,115,101,114,118,101,114,32,83,97,99,114,101,100,65,114,101,110,97,63,103,97,109,101,61,84,104,101,77,97,101,115,116,114,111,115,71,97,109,101,46,84,77,71,97,109,101,73,110,102,111,63,68,101,100,105,99,97,116,101,100,63,77,105,110,80,108,97,121,101,114,115,61,49,63,103,97,109,101,71,85,73,68,61,100,101,97,100,98,101,101,102,45,49,50,51,52,45,56,51,51,52,45,100,51,52,100,45,98,101,101,102,100,51,52,100,98,101,101,52,63,106,111,98,73,68,61,100,101,97,100,98,101,101,102,45,48,51,52,48,45,56,51,51,52,45,100,51,52,100,45,98,101,101,102,100,51,52,100,98,101,101,52,32,45,67,111,110,115,111,108,101,80,111,115,88,61,48,32,45,67,111,110,115,111,108,101,80,111,115,89,61,48,32,80,79,82,84,61,50,53,48,48,48,32,45,108,111,103,61,109,97,101,115,116,114,111,115,95,50,53,48,48,48,32,45,78,79,80,65,85,83,69,32,45,110,117,108,108,114,104,105,32,32,54,57,51,54,32,32,32,32,32,32,32,13,13,10,13,13,10,44]'
            );
        function GenerateCurrentPSListingAsBufferJSONToString() {
            return Q
                .ninvoke(require('child_process'), 'exec', 'wmic process where name="' + settings.processFileName + '" get processid,commandline')
                .then(String)
                .then((input) => {
                    let jsonB = JSON.stringify(new Buffer(input));
                    return JSON.stringify(jsonB, null, "");
                })
        }
        //console.log(twoUDKRunningWithMetaData);
        //return GenerateCurrentPSListingAsBufferJSONToString().then(console.log);
    });

    it("process listing empty", () => {
        let result = GameServer._parseLocalProcesses(noUDKRunning);
        result.should.be.an.Array;
        result.should.be.empty;
    });

    it("process listing one udk exe not server", () => {
        let result = GameServer._parseLocalProcesses(oneUDKRunningWithoutMetaData);
        result.should.be.an.Array;
        result.length.should.equal(1);
        Number(result[0].pid).should.be.greaterThan(0).and.lessThan(10000)
        result[0].jobID.should.equal(result[0].pid);
        should(result[0].gameGUID).equal(undefined);
    });
    it("process listing one udk exe is server", () => {
        let result = GameServer._parseLocalProcesses(oneUDKRunningWithMetaData);
        result.should.be.an.Array;
        result.length.should.equal(1);
        Number(result[0].pid).should.be.greaterThan(0).and.lessThan(10000);
        result[0].jobID.should.not.equal(result[0].pid)
        result[0].jobID.should.be.a.String;
        result[0].gameGUID.should.be.a.String;
        result[0].privatePort.should.be.equal("25000");
    });
    it("process listing two udk exe is server", () => {
        let result = GameServer._parseLocalProcesses(twoUDKRunningWithMetaData);
        result.should.be.an.Array;
        result.length.should.equal(2);
        Number(result[0].pid).should.be.greaterThan(0).and.lessThan(10000);
        Number(result[1].pid).should.be.greaterThan(0).and.lessThan(10000);
        result[0].jobID.should.not.equal(result[1].jobID);
        result[0].gameGUID.should.be.a.String;
        result[1].gameGUID.should.be.a.String;
    });

});

describe("GameServer startProcess", function () {
    let sandbox: any;

    beforeEach(() => {
        sandbox = sinon.sandbox.create();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it("adds aiPlayers to args", () => {
        let processInfo: I.ProcessInfo = {
            settings: {
                gameType: "",
                mapName: "",
                aiPlayers: [
                    {
                        botDifficulty: 1,
                        allyId: 0,
                        commanderName: "commander1",
                        playerName: "botPlayer1"
                    },
                    {
                        botDifficulty: 1,
                        allyId: 1,
                        commanderName: "commander2",
                        playerName: "botPlayer2"
                    }
                ],
            },
            activePlayerCount: 1,
            gameGUID: "98ahuyajb6ksdlmf",
        };
        let privatePort: number = 100;
        let jobID: string = "fakeJobId";
        let fakePromise: any = {};
        let process: string = settings.processDir + settings.processFileName; // not really what I'm testing, we'll let it not be faked
        let botSettings: string = "?NumAIPlayers=" + processInfo.settings.aiPlayers.length;
        for (let i = 0; i < processInfo.settings.aiPlayers.length; i++) {
            botSettings += "?bot" + i + "Difficulty=" + processInfo.settings.aiPlayers[i].botDifficulty;
            botSettings += "?bot" + i + "PlayerName=" + processInfo.settings.aiPlayers[i].playerName;
            botSettings += "?bot" + i + "Ally=" + processInfo.settings.aiPlayers[i].allyId;
            botSettings += "?bot" + i + "CommanderName=" + processInfo.settings.aiPlayers[i].commanderName;
        }
        let dashSettings: string = " -ConsolePosX=0 -ConsolePosY=0 PORT=" + String(privatePort) + " -forcelogflush -log=maestros_" + String(privatePort) + " -NOPAUSE -nullrhi -NOVERIFYGC";
        let expectedArgs = " server " + processInfo.settings.mapName + "?game=" + processInfo.settings.gameType + "?Dedicated?MinPlayers=" + String(processInfo.activePlayerCount) + "?gameGUID=" + processInfo.gameGUID + "?jobID=" + jobID + "?nodeLocalPort=" + settings.httpPort + "?playerStatsMethod=" + settings.playerStatsMethod + botSettings + dashSettings;
        let fakeRetVal: any = { promise: fakePromise };
        let stubStartServer = sandbox.stub(GameServer, 'startServer');
        stubStartServer.withArgs(process, expectedArgs).returns(fakeRetVal);

        let result: any = GameServer._startProcess(processInfo, privatePort, jobID);

        should(result).eql(fakePromise);
    });
});
//add .skip to skip these tests aka describe.skip(...)
describe.skip('GameServer _startProcess and _killProcess: MANUAL TESTS INSIDE ', function () {

    this.timeout(15 * 1000);
    it("Run a server and kill it", function () {
        let processInfo: I.ProcessInfo = {
            activePlayerCount: 6,
            gameGUID: "gameguid-dead-8ee4",
            settings: {
                mapName: 'SacredArena', gameType: 'TheMaestrosGame.TMGameInfo'
            }
        };
        return GameServer._startProcess(processInfo, 25000, "dead-b33F")
            .then(GameServer.getLocalProcesses)
            .then((result: any) => {
                result[0].gameGUID.should.equal(processInfo.gameGUID);
                result[0].jobID.should.equal("dead-b33F");
                result[0].privatePort.should.equal('25000');
                return result;
            })
            .then((result: any) => {return result[0] })
            .thenResolve("dead-b33F")
            .then(GameServer._killJob)
            .then(GameServer.getLocalProcesses)
            .then((result2: any) => {
                should(result2).be.an.Array().and.be.empty();
            });
    });
    //Test is slow, manually verify it failed
    it.skip("Run a server that never starts. SHOULD FAIL", function () {
        let restore = settings.gameStartedString;
        settings.gameStartedString = "KITTY";
        let processInfo: I.ProcessInfo = {
            activePlayerCount: 6,
            gameGUID: "gameguid-dead-8ee4-Game-never-starts",
            settings: {
                mapName: 'SacredArena', gameType: 'TheMaestrosGame.TMGameInfo'
            }
        };
        return GameServer._startProcess(processInfo, 25001, "dead-b33F-Game-never-starts")
            .then(GameServer.getLocalProcesses)
            .then((result) => {
                result[0].gameGUID.should.equal(processInfo.gameGUID);
                result[0].jobID.should.equal("dead-b33F");
                result[0].privatePort.should.equal('25001');
                return result;
            })
            .then((result) => {return result[0] })
            .then(GameServer._killProcess)
            .finally(() => { settings.gameStartedString = restore })
    });
    //Manual task is to kill the server part way through. Too lazy to automate.....
    //Another test is to destroy the game's files
    it.skip("MANUAL Run a server that is bad ", function () {
        let processInfo: I.ProcessInfo = {
            activePlayerCount: 6,
            gameGUID: "gameguid-dead-8ee4-Game-with-bad-gameandmap",
            settings: {
                mapName: '345', gameType: 'TheMaestrosGame.dsf'
            }
        };
        return GameServer._startProcess(processInfo, 25001, "dead-b33F-Game-with-bad-gameandmap")
            .then(GameServer.getLocalProcesses)
            .then((result) => {
                result[0].gameGUID.should.equal(processInfo.gameGUID);
                result[0].jobID.should.equal("dead-b33F-Game-never-starts");
                result[0].privatePort.should.equal('25001');
                return result;
            })
            .then((result) => {return result[0] })
            .then(GameServer._killProcess)
    });

    it("Test killJob");
});
//add .skip to skip these tests aka describe.skip(...)
describe.skip('Patch testing: MANUAL TESTS INSIDE', function () {
    this.timeout(60000);
    it.skip("patch with good URL", () => {
        settings.patchLine = "release";
        return GameServer._doPatch();
    });
    it("patch with bad URL", () => {
        settings.patchLine = "";
        return GameServer._doPatch();
    });
});
after(function () {
    console.log("\n===================");
    console.log("================================================================");
    console.warn("(If you ran any manual tests testing UDK launching)");
    console.warn("Make sure to kill any UDK.exe's! Especially if any tests failed");
    console.log("================================================================");
    console.log("===================");
});