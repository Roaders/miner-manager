
import { MinerSettings, IApplicationLaunchParams } from "../utils/miner-settings";
import { launchChild, childEvent, IChildDataEvent } from "../utils/rx-child-process";

import { Observable, Observer } from "rxjs";
import { NvidiaService, INvidiaQuery } from "../services/nvidia-service";
import { IClaymoreStats, ClaymoreService } from "../services/claymore-service";
import { spawn } from "child_process";
import { Maybe } from "maybe-monad";
import * as winston from "winston";
import * as path from "path";
import { stat } from "fs";
import { Subject } from "rxjs/Subject";

//  TODO: need to use better names to distinguish the interface and enum
export enum MinerStatus {
    waiting = "Waiting",
    launching = "Launching",
    up = "Up",
    down = "Down",
    restarting = "Restarting"
}

export interface IMinerStatus {
    status: string;
    memoryOffset: number;
    graphicsOffset: number;
    cardDetails: INvidiaQuery;
    claymoreDetails?: IClaymoreStats;
    hashEfficiency?: number;
}

export class ClaymoreMiner {

    constructor(private _card: INvidiaQuery, private _port: number, private _settings: MinerSettings) {
        const logPath = path.join(_settings.logFolder, `GPU${_card.index}_${Date.now()}.log`);

        console.log(`Creating log file: ${logPath}`);

        this._logger = new winston.Logger({
            transports: [
                new winston.transports.File({ filename: logPath })
            ]
        });

        this._logger.info(`Card id ${_card.uuid}`);

        this._claymoreService = new ClaymoreService(this._port);
        this._nvidiaSettings = new NvidiaService(this._settings);
    }

    private _nvidiaSettings: NvidiaService;

    private _claymoreService: ClaymoreService;

    private _lastClaymoreStats: IClaymoreStats;

    private _memoryOffset: number | undefined;
    private _graphicsOffset: number | undefined;

    private _status: MinerStatus = MinerStatus.waiting;

    public get status(): MinerStatus {
        return this._status;
    }

    public get card(): INvidiaQuery {
        return this._card;
    }

    public getStatusAsync(query?: INvidiaQuery): Observable<IMinerStatus> {
        if (query) {
            this._card = query;
        }

        if (this._status === MinerStatus.up || this._status === MinerStatus.launching) {
            return this._claymoreService.getMinerStats()
                .do(() => this._status = MinerStatus.up)
                .catch(error => {
                    console.error(`GPU ${this._card.index} Error getting claymore status: ${error.toString()}`);
                    return Observable.of(undefined);
                })
                .map(stats => this.constructStatus(stats));
        }
        return Observable.of(this.constructStatus());
    }

    private _logger: winston.LoggerInstance;

    public launch(): Observable<Observable<IMinerStatus>> {

        this._status = MinerStatus.launching;

        this._logger.info(`Claymore miner for index: ${this._card.index}, uuid: ${this._card.uuid} and port: ${this._port}`);

        const minerParams = this.buildMinerParams();

        const claymoreLaunch = Observable.defer(() => launchChild(() => spawn(this._settings.claymoreLaunchParams.path, minerParams)))
            .do(message => this.storeMessages(message))
            .map(message => this.handleMessages(message))
            .filter(message => message != null)
            .map<IMinerStatus | null, IMinerStatus>(m => m!)
            .merge(Observable.of(this.constructStatus()));

        const coreQuery = this._nvidiaSettings.queryAttributeValue(this._card.index, "GPUGraphicsClockOffset")
            .do(v => console.log(`GPU ${this._card.index} Graphics clock offset: ${v}`))
            .do(v => this._graphicsOffset = v);
        const memoryQuery = this._nvidiaSettings.queryAttributeValue(this._card.index, "GPUMemoryTransferRateOffset")
            .do(v => console.log(`GPU ${this._card.index} Memory clock offset: ${v}`))
            .do(v => this._memoryOffset = v);

        return Observable.create((observer: Observer<Observable<IMinerStatus>>) => {
            coreQuery
                .flatMap(() => memoryQuery)
                .subscribe(() => {
                    observer.next(claymoreLaunch);
                    observer.complete();
                });
        });
    }

    private buildMinerParams() {

        const logPath = path.join(this._settings.logFolder, `Clay_GPU${this._card.index}_${Date.now()}.log`);

        console.log(`Claymore log file: ${logPath}`);

        this._logger.info(`logPath: ${logPath}`);

        const minerParams = Maybe.nullToMaybe(this._settings.claymoreLaunchParams.params)
            .map(params => params.concat())
            .defaultTo<string[]>([]);

        minerParams.push(`-mport`, this._port.toString()); // management port
        minerParams.push(`-logfile`, logPath); // log path
        minerParams.push(`-di`, this.getCardIdentifier(this._card.index)); // card index
        minerParams.push(`-r`, "0"); // restart miner if problem (change to -r -1 to disable)

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
        if (claymoreStats) {
            this._lastClaymoreStats = claymoreStats;
        } else {
            claymoreStats = this._lastClaymoreStats;
        }

        const maybePower = Maybe.nullToMaybe(this._card.power_draw);
        const maybeHashRate = Maybe.nullToMaybe(claymoreStats)
            .map(stats => stats.ethHashes)
            .map(eth => eth.rate);

        return {
            status: this._status,
            memoryOffset: Maybe.nullToMaybe(this._memoryOffset).defaultTo(NaN),
            graphicsOffset: Maybe.nullToMaybe(this._graphicsOffset).defaultTo(NaN),
            cardDetails: this._card,
            claymoreDetails: claymoreStats,
            hashEfficiency: maybeHashRate.combine(maybePower)
                .map(([rate, power]) => rate / power)
                .defaultTo(undefined)
        };
    }

    private handleMessages(message: childEvent): IMinerStatus | null {

        switch (message.event) {

            case "data":
                console.log(`GPU ${this._card.index} (source: ${message.source}): ${message.data}`);
                if (message.data.indexOf(`Remote management is enabled`) >= 0) {
                    this._status = MinerStatus.up;
                    return this.constructStatus();
                }
                break;

            case "error":
                console.log(`GPU ${this._card.index} ERROR (source: ${message.source}): ${message.error.message}`);
                break;

            case "exit":
                console.log(`GPU ${this._card.index}: EXIT source: ${message.source}`);
                this._status = MinerStatus.down;
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
