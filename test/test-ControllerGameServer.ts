import Q = require('q');
import should = require('should');
require('should');
import sinon = require('sinon');
import ControllerGameServer = require('../controllers/GameServer');
import Enums = require('../Enums');
import I = require('../Interfaces');
import express = require('express');
import GameServer = require('../GameServer');
import TestFactory = require('./TestFactory');

describe("ControllerGameServer general tests:", function () {
    let sandbox: any;
    let setActiveHumanPlayerCountStub: any;

    beforeEach(function () {
        sandbox = sinon.sandbox.create();
        setActiveHumanPlayerCountStub = sandbox.stub(GameServer, "setActiveHumanPlayerCount");
    });

    it("Update Active Human Player Count", function () {
        let req: any = {
            body: { jobID: "jobID", activeHumanPlayerCount: 100 }
        }
        let res: any = { status: (num : number) => { }};
        let statusStub = sandbox.stub(res, "status");

        return ControllerGameServer.promiseForUpdateActiveHumanPlayerCount(req, res).then(() => {
            sinon.assert.calledWith(statusStub, 200);
            sinon.assert.calledWith(setActiveHumanPlayerCountStub, "jobID", 100);
        });
    });

    it("ParseCommand", function () {
        let command: string = "dog";
        let mapName: string = "mapName";
        let gameType: string = "gameType";
        let numOfPlayers: string = "300";
        let gameGUID: string = "gameGUID";
        let jobID: string = "jobID";
        let port: string = "100";
        let processId: string = "200";
        let commandObject = {
            command: command
        };
        
        let stringArray: Array<string> = [
            "gsoame",
            mapName,
            gameType,
            numOfPlayers,
            gameGUID,
            jobID,
            port,
            processId
        ];

        let serverSlot = TestFactory.buildServerSlot();
        let regexMatchStub = sandbox.stub(ControllerGameServer, "regexMatch").returns(stringArray);
        let getSlotFromJobIDStub = sandbox.stub(GameServer, "getSlotFromJobID").returns(serverSlot);

        let expectedResult = {
            command: command,
            mapName: mapName,
            gameType: gameType,
            numOfPlayers: parseInt(numOfPlayers),
            gameGUID: gameGUID,
            jobID: jobID,
            port: parseInt(port),
            processId: parseInt(processId),
            activeHumanPlayerCount: serverSlot.game.activeHumanPlayerCount
        };

        let result = ControllerGameServer.parseCommand(commandObject);
        result.should.have.properties(expectedResult);
    });

    afterEach(() => {
        sandbox.restore();
    });
});