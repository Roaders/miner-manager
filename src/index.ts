
import { INvidiaQuery, makeQuery } from "./utils/nvidia-smi";
import { MinerSettings } from "./utils/miner-settings";
import { Observable } from "rxjs/Observable";
import { launchChild } from "./utils/rx-child-process";
import { ClaymoreMiner, IMinerStatus } from "./miner/claymoreMiner";
import * as fs from "fs";

const settings = new MinerSettings();

if(!settings || !settings.allSettingsDefined){
    console.error(`settings not defined. Refer to help (view help with -h)`);
    process.exit();
}

try{
    fs.mkdirSync(settings.logFolder);
}
catch(e){}

function launchMiner(card: INvidiaQuery): Observable<IMinerStatus>{
    return new ClaymoreMiner( card, settings.startPort + card.index, settings ).launch();
}

makeQuery(settings.nividiSmiLaunchParams)
    .toArray()
    .do(ids => console.log(`${ids.length} cards found. Launching miners...`))
    .flatMap(ids => Observable.from(ids))
    .map(id => launchMiner(id))
    .toArray()
    .flatMap(minerStreams => Observable.combineLatest(minerStreams))
    .subscribe(
        statuses => displayMiners(statuses),
        error => console.log(`Error: ${error}`)
        );

function displayMiners(statuses: IMinerStatus[]){
    console.log(`statuses:`);

    statuses.forEach(status => {
        console.log(`card ${status.card.index} uptime: ${status.upTime} isRunning: ${status.isRunning}`)
    })
}