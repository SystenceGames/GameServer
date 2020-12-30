import nconf = require('nconf');
import Q = require('q');
import I = require('../Interfaces');

class Settings implements I.Settings {
    get gameDir(): string {
        return nconf.get('gameDir');
    }
    get queueURL(): string {
        return nconf.get('queueURL');
    }
    set queueURL(newValue: string) {
        nconf.set('queueURL', newValue);
    }
    get patchLine(): string {
        return nconf.get('patchLine');
    }
    set patchLine(newValue: string) {
        nconf.set('patchLine', newValue);
    }
    get serverAddress(): string {
        return nconf.get('serverAddress');
    }
    set serverAddress(newValue: string) {
        nconf.set('serverAddress', newValue);
    }
    get publicPorts(): number[] {
        return nconf.get('publicPorts');
    }
    get schedulerFrequency(): number {
        return nconf.get('schedulerFrequency');
    }
    get jobPollingFrequency(): number {
        return nconf.get('jobPollingFrequency');
    }
    get patchingBasePath(): string {
        return nconf.get('patchingBasePath');
    }
    get configFolderForStoringValues(): string {
        return nconf.get('configFolderForStoringValues');
    }
    get terminateWithEXTREMUMPREJUDICEAfter(): number {
        return nconf.get('terminateWithEXTREMUMPREJUDICEAfter');
    }
    get directPorts(): Array<number> {
        return nconf.get('directPorts');
    }
    get processDir(): string {
        return nconf.get('processDir');
    }
    get processFileName(): string {
        return nconf.get('processFileName');
	}
	get processArg(): string {
		return nconf.get('processArg');
	}
    set publicPorts(newValue: number[]) {
        nconf.set('publicPorts', newValue);
    }
    get dirToSearchForLogs(): string {
        return nconf.get('dirToSearchForLogs');
    }
    get gameStartedString(): string {
        return nconf.get('gameStartedString');
    }
    get GracePeriodForFileOpenTimeDifference(): number {
        return nconf.get('GracePeriodForFileOpenTimeDifference');
    }
    get HowLongToWaitForGameToStart(): number {
        return nconf.get('HowLongToWaitForGameToStart');
    }
    get PathToPatcher(): string {
        return nconf.get('PathToPatcher');
    }
    get httpPort(): number {
        return nconf.get('httpPort');
    }
    get showConsole(): boolean {
        return nconf.get('showConsole');
    }
    get jobQueueName(): string {
        return nconf.get('jobQueueName');
    }
    get graylog2(): I.Graylog2 {
        return nconf.get('graylog2');
    }
    get playerStatsMethod(): string {
        return nconf.get('playerStatsMethod');
    }
    public save(): Q.Promise<{}> {
        return Q.ninvoke(nconf, 'save');
    }
    get logMorgan(): boolean {
        return nconf.get('logMorgan');
    }
}

let gameDirString: string = "C:\\TME\\TheMaestros\\";
let rabbitMQUsername: string = "guest";
let rabbitMQPassword: string = "guest";
let rabbitMQHost: string = "127.0.0.1";
let rabbitMQPort: number = 5672;
let defaultSettings = {
    patchLine: "fakePatchLine",
    queueURL: "amqp://" + rabbitMQUsername + ":" + rabbitMQPassword + "@" + rabbitMQHost + ":" + rabbitMQPort,
    serverAddress: "127.0.0.1",
    publicPorts: [
        25000
    ],
    directPorts: [
        25000
    ],
    gameDir: gameDirString,
    httpPort: 11000,
    jobQueueName: 'jobs:local',
    schedulerFrequency: 5000,
    jobPollingFrequency: 1000,
    graylog2: {
        name: "Graylog",
        level: "debug",
        graylog: {
            servers: [{
				host: "analytics.beta.maestrosgame.com",
                port: 12201
            }],
            facility: "GameServer",
        },
        staticMeta: { shard: 'local' }
    },
    patchingBasePath: "fakePatchingBasePath",
    configFolderForStoringValues: "./config/",
    terminateWithEXTREMUMPREJUDICEAfter: 2 * 60 * 60 * 1000,
    processDir: gameDirString + "Binaries\\Win32\\",
    processFileName: "UDK.exe",
	processArg: "", // Should be empty unless running LoadTest
	dirToSearchForLogs: gameDirString + "UDKGame\\Logs\\",
    gameStartedString: "Initializing Game Engine Completed",
    GracePeriodForFileOpenTimeDifference: 1000,
    HowLongToWaitForGameToStart: 90 * 1000,
    PathToPatcher: "C:\\TME\\Tools\\PlatformDevEnv\\fakePatcher.bat",
    playerStatsMethod: "processEndGameStats",
    showConsole: true,
    logMorgan: true
};

nconf.file('./config/settings.json')
     .defaults(defaultSettings);

let settings: I.Settings = new Settings();
export = settings;