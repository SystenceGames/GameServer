import Q = require('q');
import should = require('should');
require('should');
import sinon = require('sinon');
import I = require('../Interfaces');
import settings = require('../config/settings');

describe.skip("globals MANUAL TESTS FOR SAVING READING:", function () {
    it.skip("write", () => {
        settings.publicPorts = [5, 2, 4];
        return settings.save();
    });
    it("get", () => {
        settings.publicPorts[1].should.equal(2);
    });
});