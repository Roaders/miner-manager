
import { INvidiaQuery, makeQuery } from "./utils/nvidia-smi";
import { MinerSettings } from "./utils/miner-settings";
import { Observable } from "rxjs/Observable";
import { launchChild } from "./utils/rx-child-process";
import { ClaymoreMiner, IMinerStatus } from "./miner/claymoreMiner";
import { HorizontalTable } from "cli-table2";
import { Maybe } from "maybe-monad";

import * as moment from "moment-duration-format";
import * as Table from "cli-table2";
import * as fs from "fs";

import formatDuration = require("format-duration");
import { stat } from "fs";
import { start } from "repl";

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

const nvidiaSmiStream = Observable.interval(60000)
    .startWith(0)
    .flatMap(() => makeQuery(settings.nividiSmiLaunchParams, ["power_draw","power_limit","utilization_gpu","temperature_gpu"]).toArray())
    .do(() => clear())
    .do(() => console.log(`NEW NVIDIA`))
    .share();

const minerUpdates = nvidiaSmiStream
    .take(1)
    .flatMap(createMiners);

minerUpdates.combineLatest(nvidiaSmiStream.takeUntil(minerUpdates.takeLast(1)))
    .map(([minerStatuses, nvidiaQuery]) => updateStatuses(minerStatuses, nvidiaQuery))
    .subscribe(
    statuses => displayMiners(statuses),
    error => console.log(`Error: ${error}`)
    );

function updateStatuses(minerStatuses: IMinerStatus[], cards: INvidiaQuery[]) {
    minerStatuses.forEach(status => {
        const queryResult = cards.filter(card => card.uuid === status.card.uuid);

        if(queryResult.length === 1){
            status.card = queryResult[0];
        }
    })

    return minerStatuses;
}

function createMiners(ids: INvidiaQuery[]): Observable<IMinerStatus[]> {
    const miners = ids.map(createMiner);

    const intervalStream = Observable.interval(1000)

    const minerUpdates = Observable.combineLatest(miners.map(miner => createMinerStream(miner, intervalStream)))

    return minerUpdates;
}

function createMinerStream(miner: ClaymoreMiner, interval: Observable<number>): Observable<IMinerStatus> {
    const minerUpdates = miner.launch();

    const intervalUpdates = interval.map(() => miner.status)
        .takeWhile(() => miner.status.isRunning);

    return minerUpdates.merge(intervalUpdates);
}

function displayMiners(statuses: IMinerStatus[]) {
    clear(false);

    console.log(`${statuses.length} cards found. Launching miners...`);

    const cardTable = new Table({
        head: ["Id", "Status", "Power", "%", "Temp", "Time"]
    }) as HorizontalTable;

    statuses.forEach(status => cardTable.push(buildColumns(status)));

    console.log(cardTable.toString());
}

function buildColumns(status: IMinerStatus): string[] {
    return [
        status.card.index.toString(),
        status.isRunning ? "Up" : "Down",
        displayPower(status),
        Maybe.nullToMaybe(status.card.utilization_gpu).map(x => x.toString()).defaultTo("-"),
        Maybe.nullToMaybe(status.card.temperature_gpu).map(x => x.toString()).defaultTo("-"),
        formatDuration(status.upTime)
    ];
}

function displayPower(status: IMinerStatus): string{
    const powerDraw = Maybe.nullToMaybe(status.card.power_draw).map(p => p.toFixed());
    const powerLimit = Maybe.nullToMaybe(status.card.power_limit).map(p => p.toFixed());

    return powerDraw
        .combine(powerLimit)
        .map(([draw,limit]) => `${draw}/${limit}`)
        .or(powerDraw)
        .defaultTo(`-`);
}