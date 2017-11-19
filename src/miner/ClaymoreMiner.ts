
import { MinerSettings } from "../utils/miner-settings";
import { Observable } from "rxjs/Observable";
import { INvidiaQuery } from "../utils/nvidia-smi";
import { launchChild } from "../utils/rx-child-process";
import { spawn } from "child_process";
import { Maybe } from "maybe-monad";
import * as winston from "winston";
import * as path from "path";

export class ClaymoreMiner {

    constructor(private _card: INvidiaQuery, private _port: number, private _settings: MinerSettings) {
        const logPath = path.join(_settings.logFolder,`GPU${_card.index}_${Date.now()}.log`);
        this._logger = new winston.Logger({
            transports: [
                new winston.transports.File({filename: logPath})
            ]
        });

        this._logger.info(`Card id ${_card.uuid}`);
    }
    
    private _logger: winston.LoggerInstance;

    public launch(): Observable<string> {
        const launchSettings = this._settings.claymoreLaunchParams;

        const minerParams = Maybe.nullToMaybe(launchSettings.params)
            .orElse([])
            .map(params => {params.push(`-mport ${this._port}`); return params;})
            .defaultTo(undefined);

        return Observable.defer(() => Observable.of(`Claymore miner for index: ${this._card.index}, uuid: ${this._card.uuid} and port: ${this._port}`))
            .merge(launchChild(() => spawn(launchSettings.path, minerParams))
                .do(message => this.storeMessages(message))
                .map(message => this.handleMessages(message))
                .filter(message => message != null)
                .map(message => `Card ${this._card.index}: ${message}`));
    }

    private handleMessages(message: string): string | null{

        if(/Setting DAG epoch \#\d+ for GPU0 done/.test(message)){
            return "DAG epoch creation complete, mining started"
        }

        return null;
    }

    private storeMessages(message: string){
        this._logger.info(message);
    }
}