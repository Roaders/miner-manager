
import { INvidiaQuery, makeNvidiaQuery } from "./utils/nvidia-smi";
import { MinerSettings } from "./utils/miner-settings";
import { Observable, Subject } from "rxjs";
import { launchChild } from "./utils/rx-child-process";
import { ClaymoreMiner, IMinerStatus, MinerStatus } from "./miner/claymoreMiner";
import { Maybe } from "maybe-monad";
import { displayMiners, DisplayMode } from "./utils/display-helper";
import { createKeypressStream } from "./utils/key-press-util"
import { NvidiaSettings } from "./utils/nvidia-settings"

import * as moment from "moment-duration-format";
import * as fs from "fs";

import { stat } from "fs";
import { start } from "repl";

const minerSettings = new MinerSettings();
const nvidiaSettings = new NvidiaSettings(minerSettings);

let displayMode = DisplayMode.Full;

if (minerSettings.identify != null) {
    const gpuId = minerSettings.identify;
    console.log(`Spinning up fan for GPU ${gpuId} for 20 seconds, all other fans to 0`);

    createNvidiaQueryStream()
        .flatMap(cards => Observable.forkJoin(cards.map(card => setFanSpeed(card.index, card.index === gpuId ? 100 : 0))))
        .flatMap(() => createNvidiaQueryStream())
        .delay(20 * 1000)
        .flatMap(cards => Observable.forkJoin(cards.map(card => nvidiaSettings.assignValue(card.index, "GPUFanControlState", "gpu", "0"))))
        .do(() => console.log(`Fan speed should return to normal`))
        .flatMap(() => createNvidiaQueryStream())
        .subscribe();
} else if (minerSettings.maxFans) {

    console.log(`Settings all fans to 100%`);

    createNvidiaQueryStream()
        .map(cards => cards.map(card => setFanSpeed(card.index, 100)))
        .flatMap(assignments => Observable.forkJoin(assignments))
        .subscribe();

} else if (minerSettings.resetFans) {

    console.log(`Resetting all fans`);

    createNvidiaQueryStream()
        .map(cards => cards.map(card => setFanSpeed(card.index)))
        .flatMap(assignments => Observable.forkJoin(assignments))
        .subscribe();

} else if (minerSettings.query) {
    createNvidiaQueryStream().subscribe();
} else {
    startMining();
}

function setFanSpeed(cardIndex: number, value?: number) {
    if(value){
        console.log(`Setting fan speed for ${cardIndex} to ${value}`);
    } else {
        console.log(`Resetting fan speed for ${cardIndex}`);
    }

    const state = value == null ? "0" : "1";

    return nvidiaSettings.assignValue(cardIndex, "GPUFanControlState", "gpu", state)
        .filter(() => value != null)
        .flatMap(() => nvidiaSettings.assignValue(cardIndex, "GPUTargetFanSpeed", "fan", value!.toString()));
}

function startMining() {
    if (!minerSettings.allSettingsDefined) {
        console.error(`settings not defined. Refer to help (view help with -h)`);
        process.exit();
    }

    try {
        fs.mkdirSync(minerSettings.logFolder);
    }
    catch (e) { }

    console.log(`Starting to Mine...`);
    console.log(`hit 's' to refresh stats`);
    console.log(`hit 'd' to toggle display (compact or full)`);

    createNvidiaQueryStream()
        .flatMap(createMiners)
        .sampleTime(1000)
        .subscribe(
        statuses => displayMiners(statuses, displayMode),
        error => console.log(`Error: ${error}`)
        );
}

function createNvidiaQueryStream(): Observable<INvidiaQuery[]> {
    return makeNvidiaQuery(minerSettings.nividiSmiLaunchParams, ["power_draw", "power_limit", "utilization_gpu", "temperature_gpu", "fan_speed"]);
}

function createMiners(ids: INvidiaQuery[]): Observable<IMinerStatus[]> {

    console.log(`${ids.length} cards found. Launching miners...`)

    const miners = ids.map(card => new ClaymoreMiner(card, minerSettings.startPort + card.index, minerSettings));

    const queryStream = Observable.interval(minerSettings.queryInterval)
        .merge(keyPressStream())
        .map(() => createNvidiaQueryStream())
        .mergeAll(1)
        .takeWhile(() => miners.some(miner => miner.status === MinerStatus.up))
        .share();

    const minerUpdates = Observable.combineLatest(miners.map(miner => createMinerStream(miner, queryStream)))

    return minerUpdates;
}

function keyPressStream() {
    return createKeypressStream()
        .do(key => {
            if (key.name === "d") {
                toggleDisplayMode();
                console.log(`Toggling Display Mode to: ${displayMode}`);
            }
        })
        .filter(key => key.name === "s" || key.name === "d");
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

function toggleDisplayMode() {
    if (displayMode === DisplayMode.Compact) {
        displayMode = DisplayMode.Full;
    } else {
        displayMode = DisplayMode.Compact;
    }
}