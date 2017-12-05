
import { INvidiaQuery, makeNvidiaQuery } from "./utils/nvidia-smi";
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

createNvidiaQueryStream()
    .flatMap(createMiners)
    .subscribe(
        statuses => displayMiners(statuses),
        error => console.log(`Error: ${error}`)
    );

function createNvidiaQueryStream(): Observable<INvidiaQuery[]> {
    return makeNvidiaQuery(settings.nividiSmiLaunchParams, ["power_draw", "power_limit", "utilization_gpu", "temperature_gpu"]);
}

function createMiners(ids: INvidiaQuery[]): Observable<IMinerStatus[]> {

    console.log(`creating miners: ${ids.length}`);

    const miners = ids.map( card => new ClaymoreMiner(card, settings.startPort + card.index, settings));

    const queryStream = Observable.interval(5000)
        .flatMap(() => createNvidiaQueryStream())
        .takeWhile(() => miners.some(miner => miner.isRunning));

    const minerUpdates = Observable.combineLatest(miners.map(miner => createMinerStream(miner, queryStream)))

    return minerUpdates;
}

function createMinerStream(miner: ClaymoreMiner, queries: Observable<INvidiaQuery[]>): Observable<IMinerStatus> {
    const minerUpdates = miner.launch();

    const queryUpdates = queries
        .map(queries => getQueryForCard(miner.card,queries))
        .filter(query => query != undefined)
        .map<INvidiaQuery | undefined,INvidiaQuery>(q => q!)
        .flatMap(query => miner.getStatusAsync(query))
        .takeWhile(() => miner.isRunning);

    return minerUpdates.merge(queryUpdates);
}

function getQueryForCard(card: INvidiaQuery, queries: INvidiaQuery[]): INvidiaQuery | undefined{
    return queries.filter(query => query.uuid === card.uuid)[0];
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

function displayPower(status: IMinerStatus): string {
    const powerDraw = Maybe.nullToMaybe(status.card.power_draw).map(p => p.toFixed());
    const powerLimit = Maybe.nullToMaybe(status.card.power_limit).map(p => p.toFixed());

    return powerDraw
        .combine(powerLimit)
        .map(([draw, limit]) => `${draw}/${limit}`)
        .or(powerDraw)
        .defaultTo(`-`);
}