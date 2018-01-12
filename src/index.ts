#!/usr/bin/env node

import { MinerSettings } from "./utils/miner-settings";
import { Observable, Subject } from "rxjs";
import { launchChild } from "./utils/rx-child-process";
import { checkRoot } from "./utils/root-util";
import { ClaymoreMiner, IMinerStatus, MinerStatus } from "./miner/claymoreMiner";
import { Maybe } from "maybe-monad";
import { displayMiners, DisplayMode } from "./utils/display-helper";
import { createKeypressStream } from "./utils/key-press-util"
import { NvidiaService, INvidiaQuery } from "./services/nvidia-service"

import * as moment from "moment-duration-format";
import * as fs from "fs";

import { stat } from "fs";
import { start } from "repl";
import { settings } from "cluster";

const minerSettings = new MinerSettings();
const nvidiaService = new NvidiaService(minerSettings);

let displayMode = DisplayMode.Compact;

if (minerSettings.identify != null) {
    checkRoot();
    
    const gpuId = minerSettings.identify;
    console.log(`Spinning up fan for GPU ${gpuId}, all other fans to 0`);

    createNvidiaQueryStream()
        .flatMap(cards => Observable.from(cards.map(card => nvidiaService.setFanSpeed(card.index, card.index === gpuId ? 100 : 0))))
        .mergeAll(2)
        .subscribe();
} else if (minerSettings.maxFans) {
    checkRoot();

    console.log(`Settings all fans to 100%`);

    createNvidiaQueryStream()
        .flatMap(cards => Observable.from(cards.map(card => nvidiaService.setFanSpeed(card.index, 100))))
        .mergeAll(2)
        .subscribe();

} else if (minerSettings.resetFans) {
    checkRoot();

    console.log(`Resetting all fans`);

    createNvidiaQueryStream()
        .flatMap(cards => Observable.from(cards.map(card => nvidiaService.setFanSpeed(card.index))))
        .mergeAll(2)
        .subscribe();

} else if (minerSettings.query) {
    createNvidiaQueryStream().subscribe();
} else if (minerSettings.setup) {
    checkRoot();

    console.log(`Generating Fake Monitors...`);

    nvidiaService.setupMonitors().subscribe(
        () => { },
        () => { },
        () => console.log(`Monitor Configuration Complete. Please restart system.`)
    );
} else if (minerSettings.applySettings) {

    console.log(`Applying initial Settings...`);

    createNvidiaQueryStream()
        .flatMap(initialSettings)
        .subscribe(() => console.log(`all settings applied`));
} else {
    startMining();
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
        .flatMap(initialSettings)
        .flatMap(createMiners)
        .sampleTime(1000)
        .subscribe(
        statuses => displayMiners(statuses, displayMode),
        error => console.log(`Error: ${error}`)
        );
}

function initialSettings(cards: INvidiaQuery[]): Observable<INvidiaQuery[]> {
    console.log(`Initial settings`);

    let returnObservable = Observable.from(cards.map(card => nvidiaService.setFanSpeed(card.index)))
        .mergeAll(2).toArray()
        .do(() => console.log(`Setting power limits...`))
        .flatMap(() => Observable.from(cards.map(card => nvidiaService.setPowerLimit(card, 100))))
        .mergeAll(2).toArray();

    if (minerSettings.initialClock != null) {
        const clockSetting = minerSettings.initialClock.toString();
        const observables = cards.map(card => nvidiaService.assignAttributeValue(card.index, "GPUMemoryTransferRateOffset", "gpu", clockSetting));
        returnObservable = returnObservable.flatMap(() => Observable.from(observables))
            .mergeAll(2)
            .toArray();
    }

    return returnObservable
        .do(() => console.log(`Initial settings complete`))
        .map(() => cards);
}

function createNvidiaQueryStream(): Observable<INvidiaQuery[]> {
    return nvidiaService.query(["power_draw", "power_limit", "power_min_limit", "utilization_gpu", "temperature_gpu", "fan_speed"]);
}

function createMiners(ids: INvidiaQuery[]): Observable<IMinerStatus[]> {

    console.log(`${ids.length} cards found. Launching miners...`)

    const miners = ids.map(card => new ClaymoreMiner(card, minerSettings.startPort + card.index, minerSettings));

    const queryStream = Observable.interval(minerSettings.queryInterval)
        .merge(keyPressStream().do(key => console.log(`Keypress '${key.name}' detected`)))
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