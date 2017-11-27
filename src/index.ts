
import { INvidiaQuery, makeQuery } from "./utils/nvidia-smi";
import { MinerSettings } from "./utils/miner-settings";
import { Observable } from "rxjs/Observable";
import { launchChild } from "./utils/rx-child-process";
import { ClaymoreMiner, IMinerStatus } from "./miner/claymoreMiner";
import { HorizontalTable } from "cli-table2";
import * as moment from "moment-duration-format";
import * as Table from "cli-table2";
import * as fs from "fs";
const clear = require("clear");

const settings = new MinerSettings();

if (!settings || !settings.allSettingsDefined) {
    console.error(`settings not defined. Refer to help (view help with -h)`);
    process.exit();
}

try {
    fs.mkdirSync(settings.logFolder);
}
catch (e) { }

function createMiner(card: INvidiaQuery): ClaymoreMiner {
    return new ClaymoreMiner(card, settings.startPort + card.index, settings);
}

makeQuery(settings.nividiSmiLaunchParams)
    .toArray()
    .flatMap(createMiners)
    .subscribe(
        statuses => displayMiners(statuses),
        error => console.log(`Error: ${error}`)
        );

function createMiners(ids: INvidiaQuery[]): Observable<IMinerStatus[]> {
    const miners = ids.map(createMiner);

    const intervalStream = Observable.interval(1000)

    const minerUpdates = Observable.combineLatest(miners.map(miner => createMinerStream(miner, intervalStream)))

    return minerUpdates;
}

function createMinerStream(miner: ClaymoreMiner, interval: Observable<number>): Observable<IMinerStatus>{
    const minerUpdates = miner.launch();

    const intervalUpdates = interval.map(() => miner.status)
        .takeWhile(() => miner.status.isRunning);

    return minerUpdates.merge(intervalUpdates);
}

function displayMiners(statuses: IMinerStatus[]) {
    clear();

    console.log(`${statuses.length} cards found. Launching miners...`);

    const cardTable = new Table({
        head: ["Id", "Status", "Uptime"]
    }) as HorizontalTable;

    statuses.forEach(status => cardTable.push(buildColumns(status)));

    console.log(cardTable.toString());
}

function buildColumns(status: IMinerStatus): string[]{
    return [
        status.card.index.toString(),
        status.isRunning ? "Up" : "Down",
        Math.floor(status.upTime / 1000).toString()
    ];
}