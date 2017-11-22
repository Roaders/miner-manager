
import { MinerSettings } from "../utils/miner-settings";
import { Observable } from "rxjs/Observable";
import { INvidiaQuery } from "../utils/nvidia-smi";
import { launchChild, childEvent } from "../utils/rx-child-process";
import { spawn } from "child_process";
import { Maybe } from "maybe-monad";
import * as winston from "winston";
import * as path from "path";

export interface IMinerStatus {
    isRunning: boolean;
    upTime: number;
    card: INvidiaQuery;
}

export class ClaymoreMiner {

    constructor(private _card: INvidiaQuery, private _port: number, private _settings: MinerSettings) {
        const logPath = path.join(_settings.logFolder, `GPU${_card.index}_${Date.now()}.log`);
        this._logger = new winston.Logger({
            transports: [
                new winston.transports.File({ filename: logPath })
            ]
        });

        this._logger.info(`Card id ${_card.uuid}`);
    }

    private _isRunning: boolean;

    private _startTime: number | undefined;
    private _endTime: number | undefined;

    public get status(): IMinerStatus {
        return {
            isRunning: this._isRunning,
            upTime: Maybe.nullToMaybe(this._startTime)
                .combine(Maybe.nullToMaybe(this._endTime)
                    .orElse(Date.now()))
                .map(([startTime, endTime]) => endTime - startTime)
                .defaultTo(0),
            card: this._card
        };
    }

    private _logger: winston.LoggerInstance;

    public launch(): Observable<IMinerStatus> {
        this._startTime = Date.now();

        const launchSettings = this._settings.claymoreLaunchParams;
        const logPath = path.join(this._settings.logFolder, `Clay_GPU${this._card.index}_${Date.now()}.log`);

        const minerParams = Maybe.nullToMaybe(launchSettings.params)
            .orElse([])
            .map(params => { params.push(`-mport`); return params; })
            .map(params => { params.push(this._port.toString()); return params; })
            .map(params => { params.push(`-logfile`); return params; })
            .map(params => { params.push(logPath); return params; })
            .map(params => { params.push(`-di`); return params; })
            .map(params => { params.push(this.getCardIdentifier(this._card.index)); return params; })
            .map(params => { params.push(`-erate`); return params; })
            .map(params => { params.push("0"); return params; })
            .map(params => { params.push(`-r`); return params; })
            .map(params => { params.push("1"); return params; })
            .defaultTo(undefined);

        this._isRunning = true;

        this._logger.info(`Claymore miner for index: ${this._card.index}, uuid: ${this._card.uuid} and port: ${this._port}`);

        return Observable.defer(() => launchChild(() => spawn(launchSettings.path, minerParams))
            .do(message => this.storeMessages(message))
            .map(message => this.handleMessages(message))
            .filter(message => message != null)
            .map<IMinerStatus | null, IMinerStatus>(m => m!))
            .merge(Observable.of(this.status));
    }

    private getCardIdentifier(index: number): string {
        if (index > 9) {
            return String.fromCharCode(97 + (index - 10));
        } else {
            return index.toString();
        }
    }

    private handleMessages(message: childEvent): IMinerStatus | null {

        switch (message.event) {
            case "data":
                if (/Setting DAG epoch \#\d+ for GPU\d done/.test(message.data)) {
                    return null;
                }
                break;

            case "exit":
                this._isRunning = true;
                return this.status;
        }

        return null;
    }

    private storeMessages(message: childEvent) {
        switch (message.event) {
            case "data":
                this._logger.info(message.data, [message]);
                break;

            case "error":
                this._logger.error(message.error.toString(), [message]);
                break;

            default:
                this._logger.info(`${message.source} - ${message.event}`, [message]);
        }
    }

}
