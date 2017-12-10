
import { MinerSettings, IApplicationLaunchParams } from "../utils/miner-settings";
import { launchChild, childEvent } from "../utils/rx-child-process";
import { ClaymoreService, IClaymoreStats } from "../services/claymoreService";

import { Observable } from "rxjs/Observable";
import { INvidiaQuery } from "../utils/nvidia-smi";
import { spawn } from "child_process";
import { Maybe } from "maybe-monad";
import * as winston from "winston";
import * as path from "path";

export enum MinerStatus{
    waiting = "Waiting",
    up = "Up",
    down = "Down",
    restarting = "Restarting"
}

export interface IMinerStatus {
    status: string;
    upTime: number;
    cardDetails: INvidiaQuery;
    claymoreDetails?: IClaymoreStats
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

        this._claymoreService = new ClaymoreService(this._port);
    }

    private _claymoreService: ClaymoreService;

    private _startTime: number | undefined;
    private _endTime: number | undefined;

    private _status: MinerStatus = MinerStatus.waiting;

    public get status(): MinerStatus {
        return this._status;
    }

    public get card(): INvidiaQuery {
        return this._card;
    }

    public getStatusAsync(query?: INvidiaQuery): Observable<IMinerStatus> {
        if(query){
            this._card = query;
        }

        if(this._status === MinerStatus.up){
            return this._claymoreService.getMinerStats()
                .map(stats => this.constructStatus(stats));
        }
        return Observable.of(this.constructStatus());
    }

    private _logger: winston.LoggerInstance;

    public launch(): Observable<IMinerStatus> {
        this._startTime = Date.now();

        const minerParams = this.buildMinerParams();

        this._logger.info(`Claymore miner for index: ${this._card.index}, uuid: ${this._card.uuid} and port: ${this._port}`);

        return Observable.defer(() => launchChild(() => spawn(this._settings.claymoreLaunchParams.path, minerParams))
            .do(message => this.storeMessages(message))
            .map(message => this.handleMessages(message))
            .filter(message => message != null)
            .map<childEvent | null, childEvent>(m => m!))
            .flatMap(() => this.getStatusAsync())
            .merge(this.getStatusAsync());
    }

    private buildMinerParams() {

        const logPath = path.join(this._settings.logFolder, `Clay_GPU${this._card.index}_${Date.now()}.log`);

        const minerParams = Maybe.nullToMaybe(this._settings.claymoreLaunchParams.params)
            .map(params => params.concat())
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

    private constructStatus(claymoreStats?: IClaymoreStats): IMinerStatus {

        return {
            status: this._status,
            upTime: Maybe.nullToMaybe(this._startTime)
                .combine(Maybe.nullToMaybe(this._endTime)
                    .orElse(Date.now()))
                .map(([startTime, endTime]) => endTime - startTime)
                .defaultTo(0),
            cardDetails: this._card,
            claymoreDetails: claymoreStats
        };
    }

    private handleMessages(message: childEvent): childEvent | null {

        switch (message.event) {

            case "data":
                console.log(`GPU ${this._card.index} (source: ${message.source}): ${message.data}`);
                if(message.data.indexOf(`Remote management is enabled`) >= 0){
                    this._status = MinerStatus.up;
                    return message;
                }
                break;

            case "error":
                console.log(`GPU ${this._card.index} ERROR (source: ${message.source}): ${message.error.message}`);
                break;

            case "exit":
                console.log(`GPU ${this._card.index}: EXIT source: ${message.source}`);
                this._status = MinerStatus.down;
                return message;

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
