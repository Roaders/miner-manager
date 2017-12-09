
import * as path from "path";
import * as commandLineArgs from "command-line-args";
import { ICommandLineValues, commandArgs } from "./command-line-args";
import { Maybe } from "maybe-monad";

export interface IApplicationLaunchParams {
    path: string;
    params?: string[];
}

export class MinerSettings {

    constructor() {
        const commandLineValues: ICommandLineValues = commandLineArgs(commandArgs);

        const startPortMaybe = Maybe.nullToMaybe(commandLineValues.startPort);
        const logFolderMaybe = Maybe.nullToMaybe(commandLineValues.logFolder);
        const claymorePathMaybe = Maybe.nullToMaybe(commandLineValues.claymorePath);

        this._settingsValid = !startPortMaybe
            .combine(logFolderMaybe)
            .combine(claymorePathMaybe)
            .isNothing;

        this._startPort = startPortMaybe.value;
        this._logFolder = logFolderMaybe.value;
        this._claymorePath = claymorePathMaybe.value;

        this._nvidiaSmiPath = Maybe.nullToMaybe(commandLineValues.nvidiaSmiPath).defaultTo("nvidia-smi");
        this._nvidiaSmiParams = commandLineValues.nvidiaSmiParams;
        this._claymoreParams = commandLineValues.claymoreParams;
        this._minerBaseName = commandLineValues.minerBaseName;
        this._poolAddress = commandLineValues.poolAddress;
        this._walletAddress = commandLineValues.walletAddress;
        this._queryInterval = commandLineValues.queryInterval;
    }

    private _settingsValid: boolean;

    public get allSettingsDefined(): boolean {
        return this._settingsValid;
    }

    private _nvidiaSmiPath: string;
    private _nvidiaSmiParams?: string[];

    public get nividiSmiLaunchParams(): IApplicationLaunchParams {
        return {
            path: this._nvidiaSmiPath,
            params: this._nvidiaSmiParams
        }
    }

    private _claymorePath: string;
    private _claymoreParams?: string[];

    public get claymoreLaunchParams(): IApplicationLaunchParams {
        return {
            path: this._claymorePath,
            params: this._claymoreParams
        }
    }

    private _startPort: number;

    public get startPort(): number {
        return this._startPort;
    }

    private _queryInterval: number;

    public get queryInterval(): number {
        return this._queryInterval;
    }

    private _minerBaseName: string | undefined;

    public get minerBaseName(): string | undefined {
        return this._minerBaseName;
    }

    private _poolAddress: string | undefined;

    public get poolAddress(): string | undefined {
        return this._poolAddress;
    }

    private _walletAddress: string | undefined;

    public get walletAddress(): string | undefined {
        return this._walletAddress;
    }

    private _logFolder: string;

    public get logFolder(): string {
        return path.join(process.cwd(), this._logFolder);
    }
}