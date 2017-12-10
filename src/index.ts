
import { INvidiaQuery, makeNvidiaQuery } from "./utils/nvidia-smi";
import { MinerSettings } from "./utils/miner-settings";
import { Observable } from "rxjs/Observable";
import { launchChild } from "./utils/rx-child-process";
import { ClaymoreMiner, IMinerStatus, MinerStatus } from "./miner/claymoreMiner";
import { Maybe } from "maybe-monad";
import { displayMiners } from "./utils/display-helper";

import * as moment from "moment-duration-format";
import * as fs from "fs";

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
        .map(queries => queries.filter(query => query.uuid === miner.card.uuid)[0])
        .filter(query => query != undefined)
        .map<INvidiaQuery | undefined, INvidiaQuery>(q => q!)
        .flatMap(query => miner.getStatusAsync(query))
        .takeWhile(() => miner.status !== MinerStatus.down);

    return minerUpdates.merge(queryUpdates);
}