
import {INvidiaQuery, makeQuery} from "./utils/nvidia-smi";

makeQuery(["index","uuid"])
    .toArray()
    .subscribe(
        ids => console.log(`${ids.length} cards found. Launching miners...`),
        error => console.log(`Error: ${error}`)
    );