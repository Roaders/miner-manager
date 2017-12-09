
import { MinerSettings, IApplicationLaunchParams } from "../utils/miner-settings";
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

    public get isRunning(): boolean {
        return this._isRunning;
    }

    public get card(): INvidiaQuery {
        return this._card;
    }

    public getStatusAsync(query: INvidiaQuery): Observable<IMinerStatus> {
        return Observable.of(this.constructStatus());
    }

    private _logger: winston.LoggerInstance;

    public launch(): Observable<IMinerStatus> {
        this._startTime = Date.now();

        const minerParams = this.buildMinerParams();

        this._isRunning = true;

        this._logger.info(`Claymore miner for index: ${this._card.index}, uuid: ${this._card.uuid} and port: ${this._port}`);

        return Observable.defer(() => launchChild(() => spawn(this._settings.claymoreLaunchParams.path, minerParams))
            .do(message => this.storeMessages(message))
            .map(message => this.handleMessages(message))
            .filter(message => message != null)
            .map<IMinerStatus | null, IMinerStatus>(m => m!))
            .merge(this.getStatusAsync(this._card));
    }

    private buildMinerParams() {

        const logPath = path.join(this._settings.logFolder, `Clay_GPU${this._card.index}_${Date.now()}.log`);

        const minerParams = Maybe.nullToMaybe(this._settings.claymoreLaunchParams.params)
            .defaultTo<string[]>([]);

        minerParams.push(`-mport`, this._port.toString()); // management port
        minerParams.push(`-logfile`, logPath); // log path
        minerParams.push(`-di`, this.getCardIdentifier(this._card.index)); // card index
        minerParams.push(`-r`, "1"); // do not restart miner

        const poolAddress = Maybe.nullToMaybe(this._settings.poolAddress);
        const walletAddress = Maybe.nullToMaybe(this._settings.walletAddress);
        const name = Maybe.nullToMaybe(this._settings.minerBaseName)
            .orElse("Miner")
            .map(name => `${name}_${this._card.index}`);

        poolAddress.combine(walletAddress, name)
            .do(([pool, wallet, name]) => {
                minerParams.push("-eworker", name)  //  Worker Name
                minerParams.push("-epool", pool)  //  Pool Address
                minerParams.push("-ewal", wallet)  //  Wallet Address
            })
            .elseDo(() => minerParams.push("-erate", "0")); // do not send rate as we will have multiple miners on same name


        return minerParams;
    }

    private getCardIdentifier(index: number): string {
        if (index > 9) {
            return String.fromCharCode(97 + (index - 10));
        } else {
            return index.toString();
        }
    }

    private constructStatus(): { isRunning: boolean; upTime: number; card: INvidiaQuery; } {
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

    private handleMessages(message: childEvent): IMinerStatus | null {

        switch (message.event) {

            case "data":
                console.log(`GPU ${this._card.index} (source: ${message.source}): ${message.data}`);
                break;

            case "error":
                console.log(`GPU ${this._card.index} ERROR (source: ${message.source}): ${message.error.message}`);
                break;

            case "exit":
                console.log(`GPU ${this._card.index}: EXIT source: ${message.source}`);
                this._isRunning = false;
                return this.constructStatus();

            default:
                console.log(`GPU ${this._card.index} event: ${message.event} source: ${message.source}`);

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
