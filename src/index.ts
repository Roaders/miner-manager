
import {INvidiaQuery, makeQuery} from "./utils/nvidia-smi";
import {MinerSettings} from "./utils/miner-settings";

const settings = new MinerSettings();

settings.nividiSmiLaunchParams
    .flatMap(params => makeQuery(params, ["index","uuid"]))
    .toArray()
    .subscribe(
        ids => console.log(`${ids.length} cards found. Launching miners...`),
        error => console.log(`Error: ${error}`)
    );