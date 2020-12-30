import Enums = require('./Enums');

export interface Job {
    jobID: string;
    processInfo: ProcessInfo;
    callbackURL: string;
}
export interface AiPlayer {
    botDifficulty: number;
    playerName: string;
    commanderName: string;
    allyId: number;
}
export interface ProcessInfo {
    settings: { mapName: string, gameType: string, aiPlayers?: Array<AiPlayer>};
    activePlayerCount: number;
    gameGUID: string;
}
export interface Endpoint {
    publicPort: number;
    privatePort: number;
}
export interface ServerSlot extends Endpoint {
    status: Enums.ServerSlotStatus;
    job?: Job;
    game?: Game;
    timerForGameStartingTimeout?: number;
    tagged?: boolean;
}
export interface Game {
    activeHumanPlayerCount: number;
    jobId: string;
}
export interface ConnectionInfo {
    serverHostName: string;
    publicPort: number;
}
export interface ProcessStatus {
    gameGUID?: string;
    jobID: string;
    pid: string;
    privatePort?: string;
    command?: string;
}
export interface Graylog2 {
    graylogHost: string;
    graylogPort: number;
    graylogFacility: string;
}
export interface Settings {
    patchLine: string;
    queueURL: string;
    serverAddress: string;
    publicPorts: Array<number>;
    directPorts: Array<number>;
    gameDir: string;
    httpPort: number;
    jobQueueName: string;
    schedulerFrequency: number;
    jobPollingFrequency: number;
    patchingBasePath: string;
    graylog2: Graylog2;
    configFolderForStoringValues: string;
    terminateWithEXTREMUMPREJUDICEAfter: number;
    processDir: string;
	processFileName: string;
	processArg: string;
    dirToSearchForLogs: string;
    gameStartedString: string;
    GracePeriodForFileOpenTimeDifference: number;
    HowLongToWaitForGameToStart: number;
    PathToPatcher: string;
    showConsole: boolean;
    playerStatsMethod: string;
    save: () => Q.Promise<{}>;
    logMorgan: boolean;
}

export interface GameServerStatus {
    isEnabled: boolean;
    needsPatching: boolean;
    isPatching: boolean;
    slots: ServerSlot[];
    settings: Settings;
}