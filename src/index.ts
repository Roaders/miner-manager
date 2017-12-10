
import { INvidiaQuery, makeNvidiaQuery } from "./utils/nvidia-smi";
import { MinerSettings } from "./utils/miner-settings";
import { Observable } from "rxjs/Observable";
import { launchChild } from "./utils/rx-child-process";
import { ClaymoreMiner, IMinerStatus, MinerStatus } from "./miner/claymoreMiner";
import { HorizontalTable } from "cli-table2";
import { Maybe } from "maybe-monad";

import * as moment from "moment-duration-format";
import * as Table from "cli-table2";
import * as fs from "fs";

import formatDuration = require("format-duration");
import { stat } from "fs";
import { start } from "repl";

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
    .sampleTime(1000)
    .subscribe(
    statuses => displayMiners(statuses),
    error => console.log(`Error: ${error}`)
    );

function createNvidiaQueryStream(): Observable<INvidiaQuery[]> {
    return makeNvidiaQuery(settings.nividiSmiLaunchParams, ["power_draw", "power_limit", "utilization_gpu", "temperature_gpu"]);
}

function createMiners(ids: INvidiaQuery[]): Observable<IMinerStatus[]> {

    console.log(`${ids.length} cards found. Launching miners...`)

    const miners = ids.map(card => new ClaymoreMiner(card, settings.startPort + card.index, settings));

    const queryStream = Observable.interval(settings.queryInterval)
        .flatMap(() => createNvidiaQueryStream())
        .takeWhile(() => miners.some(miner => miner.status === MinerStatus.up))
        .share();

    const minerUpdates = Observable.combineLatest(miners.map(miner => createMinerStream(miner, queryStream)))

    return minerUpdates;
}

function createMinerStream(miner: ClaymoreMiner, queries: Observable<INvidiaQuery[]>): Observable<IMinerStatus> {
    const minerUpdates = miner.launch();

    const queryUpdates = queries
        .map(queries => getQueryForCard(miner.card, queries))
        .filter(query => query != undefined)
        .map<INvidiaQuery | undefined, INvidiaQuery>(q => q!)
        .flatMap(query => miner.getStatusAsync(query))
        .takeWhile(() => miner.status === MinerStatus.up);

    return minerUpdates.merge(queryUpdates);
}

function getQueryForCard(card: INvidiaQuery, queries: INvidiaQuery[]): INvidiaQuery | undefined {
    return queries.filter(query => query.uuid === card.uuid)[0];
}

function displayMiners(statuses: IMinerStatus[]) {
    const cardTable = new Table({
        head: ["Id", "Status", "Power", "%", "Temp", "Time", "Rate", "Shares"]
    }) as HorizontalTable;

    statuses.forEach(status => cardTable.push(buildColumns(status)));

    console.log(cardTable.toString());
}

function buildColumns(status: IMinerStatus): string[] {
    const cardMaybe = Maybe.nullToMaybe(status.cardDetails);
    const claymoreMaybe = Maybe.nullToMaybe(status.claymoreDetails);
    const mineMaybe = claymoreMaybe.map(x => x.ethHashes);

    return [
        status.cardDetails.index.toString(),
        status.status,
        displayPower(status),
        cardMaybe.map(details => details.utilization_gpu).map(x => x.toString()).defaultTo("-"),
        cardMaybe.map(details => details.temperature_gpu).map(x => x.toString()).defaultTo("-"),
        claymoreMaybe.map(details => details.runningTimeMs).map(x => formatDuration(x)).defaultTo("-"),
        mineMaybe.map(details => details.rate).map(x => x.toString()).defaultTo("-"),
        mineMaybe.map(details => details.shares)
            .combine(mineMaybe.map(d => d.rejected),mineMaybe.map(d => d.invalid))
            .map(([shares, rejected, invalid]) => `${shares} (${rejected}/${invalid})`)
            .defaultTo("-")
    ];
}

function displayPower(status: IMinerStatus): string {
    const powerDraw = Maybe.nullToMaybe(status.cardDetails.power_draw).map(p => p.toFixed());
    const powerLimit = Maybe.nullToMaybe(status.cardDetails.power_limit).map(p => p.toFixed());

    return powerDraw
        .combine(powerLimit)
        .map(([draw, limit]) => `${draw}/${limit}`)
        .or(powerDraw)
        .defaultTo(`-`);
}