import Q = require('q');
import should = require('should');
require('should');
let amqp = require('amqplib');
import settings = require('../config/settings');
import GameServer = require('../GameServer');

//Note: you must install rabbitMQ before enabling these tests
describe.skip("amqp tests(NEED RABBITMQ)", function () {
    let connection: any;
    beforeEach(() => {
        settings.queueURL = 'amqp://localhost';
        console.log(settings.queueURL);
        return amqp.connect(settings.queueURL).then((conn: any) => { connection = conn });
    });

    this.timeout(5 * 60 * 1000);
    it("Getjob test", () => {

        // Publisher
        return postJSONToQueue({ test: 'test' }, settings.queueURL, settings.jobQueueName).then(() => {
            return Q.all([
                GameServer._lookForJob(),
                GameServer._lookForJob()
            ])
        }).then((results) => {
                results.should.be.an.Array;
                results.length.should.equal(2);
                if (results[0]) {
                    results[0].should.eql({ test: 'test' });
                    should(results[1]).equal(null);
                } else {
                    results[1].should.eql({ test: 'test' });
                    should(results[0]).equal(null);
                }
                console.log(results);
            });
    });
    it.skip("many tests", (done: any) => {
        let count = 0
        setInterval(runtest, 0);
        function runtest() {
            console.log(count++);

            //Q(postJSONToQueue({ test: 'test' }, settings.queueURL, config.jobQueueName)).done();
            GameServer._lookForJob().then(console.log);
            Q(postJSONToQueue2({ test: 'test' })).done();
            //getJSONFromQueue2().then(console.log);
        }
        function getJSONFromQueue2(): Q.Promise<{}> {
            return connection.createChannel()
                .then((channel: any) => {
                    channel.assertQueue(settings.jobQueueName, { durable: true });
                    return channel.get(settings.jobQueueName, { noAck: true });
                })
                .then((msg: any) => {
                    if (!msg) return null;
                    return JSON.parse(msg.content);
                });
        }

        function postJSONToQueue2(input: {}): Q.Promise<any> {
            return connection.createChannel()
                .then(function (ch: any) {
                    let ok = ch.assertQueue(settings.jobQueueName, { durable: true });
                    return ok.then(function () {
                        let msg = JSON.stringify(input);
                        return ch.sendToQueue(settings.jobQueueName, new Buffer(msg), { persistent: true });
                    });
                });
        }

    });

    function getJSONFromQueue(url: any, queueName: any): Q.Promise<{}> {
        return Q(amqp.connect(url))
            .invoke('createChannel')
            .then((channel: any) => {
                channel.assertQueue(queueName, { durable: true });
                return channel.get(queueName, { noAck: true });
            })
            .then((msg) => {
                if (!msg) return null;
                return JSON.parse(msg.content);
            })
    }

    function postJSONToQueue(input: {}, url: any, queueName: any): Q.Promise<any> {
        return Q(amqp.connect(url))
            .then(function (conn) {
                return Q(conn.createChannel().then(function (ch: any) {
                    let ok = ch.assertQueue(queueName, { durable: true });
                    return ok.then(function () {
                        let msg = JSON.stringify(input);
                        return ch.sendToQueue(queueName, new Buffer(msg), { persistent: true });
                    });
                }))
            })
    }

});