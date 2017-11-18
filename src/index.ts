
import { INvidiaQuery, makeQuery } from "./utils/nvidia-smi";
import { MinerSettings } from "./utils/miner-settings";
import { Observable } from "rxjs/Observable";
import { launchChild } from "./utils/rx-child-process";
import { ClaymoreMiner } from "./miner/ClaymoreMiner";

const settings = new MinerSettings();

function launchMiner(card: INvidiaQuery): Observable<string>{
    return new ClaymoreMiner( card, settings.startPort + card.index, settings ).launch();
}

makeQuery(settings.nividiSmiLaunchParams)
    .toArray()
    .do(ids => console.log(`${ids.length} cards found. Launching miners...`))
    .flatMap(ids => Observable.from(ids))
    .flatMap(id => launchMiner(id))
    .subscribe(
        output => console.log(output),
        error => console.log(`Error: ${error}`)
        );