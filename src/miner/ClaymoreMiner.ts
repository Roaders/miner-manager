
import { MinerSettings } from "../utils/miner-settings";
import { Observable } from "rxjs/Observable";
import { INvidiaQuery } from "../utils/nvidia-smi";
import { launchChild } from "../utils/rx-child-process";
import { spawn } from "child_process";

export class ClaymoreMiner{

    constructor(private _card: INvidiaQuery, private _port: number, private _settings: MinerSettings ){
    }

    public launch(): Observable<string>{
        const params = this._settings.claymoreLaunchParams;

        return Observable.defer(() => Observable.of(`Claymore miner for index: ${this._card.index}, uuid: ${this._card.uuid} and port: ${this._port}`))
            .merge(launchChild(() => spawn(params.path, params.params))
                .map(message => `Card ${this._card.index}: ${message}`));
    }
}