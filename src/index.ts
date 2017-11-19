
import { INvidiaQuery, makeQuery } from "./utils/nvidia-smi";
import { MinerSettings } from "./utils/miner-settings";
import { Observable } from "rxjs/Observable";
import { launchChild } from "./utils/rx-child-process";
import { ClaymoreMiner } from "./miner/ClaymoreMiner";
import * as fs from "fs";

const settings = new MinerSettings();

if(!settings || !settings.allSettingsDefined){
    console.error(`settings not defined. Refer to help (pass -h)`);
    process.exit();
}

try{
    fs.mkdirSync(settings.logFolder);
}
catch(e){}

function launchMiner(card: INvidiaQuery): Observable<string>{
    return new ClaymoreMiner( card, settings.startPort + card.index, settings ).launch();
}

makeQuery(settings.nividiSmiLaunchParams)
    .toArray()
    .do(ids => console.log(`${ids.length} cards found. Launching miners...`))
    .flatMap(ids => Observable.from(ids))
    .flatMap(id => launchMiner(id))
    .subscribe(
        undefined,
        error => console.log(`Error: ${error}`)
        );