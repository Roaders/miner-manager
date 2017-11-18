
import { MinerSettings } from "../utils/miner-settings";
import { Observable } from "rxjs/Observable";
import { INvidiaQuery } from "../utils/nvidia-smi";
import { launchChild } from "../utils/rx-child-process";
import { spawn } from "child_process";
import { Maybe } from "maybe-monad";

export class ClaymoreMiner {

    constructor(private _card: INvidiaQuery, private _port: number, private _settings: MinerSettings) {
    }

    public launch(): Observable<string> {
        const launchSettings = this._settings.claymoreLaunchParams;

        const minerParams = Maybe.nullToMaybe(launchSettings.params)
            .orElse([])
            .map(params => {params.push(`-mport ${this._port}`); return params;})
            .defaultTo(undefined);

        return Observable.defer(() => Observable.of(`Claymore miner for index: ${this._card.index}, uuid: ${this._card.uuid} and port: ${this._port}`))
            .merge(launchChild(() => spawn(launchSettings.path, minerParams))
                .map(message => `Card ${this._card.index}: ${message}`));
    }
}