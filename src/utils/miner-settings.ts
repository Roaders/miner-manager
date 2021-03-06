
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

        if (this._settingsValid) {
            this._startPort = startPortMaybe.value;
            this._logFolder = this.makePathAbsolute(logFolderMaybe.value);
            this._claymorePath = claymorePathMaybe.value;
        }

        this._nvidiaSmiPath = Maybe.nullToMaybe(commandLineValues.nvidiaSmiPath).defaultTo("nvidia-smi");
        this._nvidiaSmiParams = commandLineValues.nvidiaSmiParams;
        this._nvidiaSettingsPath = Maybe.nullToMaybe(commandLineValues.nvidiaSettingsPath).defaultTo("nvidia-settings");
        this._nvidiaSettingsParams = commandLineValues.nvidiaSettingsParams;
        this._nvidiaXconfigPath = Maybe.nullToMaybe(commandLineValues.nvidiaXConfigPath).defaultTo("nvidia-xconfig");
        this._nvidiaXconfigParams = commandLineValues.nvidiaXConfigParams;
        this._claymoreParams = commandLineValues.claymoreParams;
        this._minerBaseName = commandLineValues.minerBaseName;
        this._poolAddress = commandLineValues.poolAddress;
        this._walletAddress = commandLineValues.walletAddress;
        this._queryInterval = commandLineValues.queryInterval;
        this._query = commandLineValues.query;
        this._maxFans = commandLineValues.maxFans;
        this._resetFans = commandLineValues.resetFans;
        this._identify = commandLineValues.identify;
        this._initialClock = commandLineValues.initialClock;
        this._setup = commandLineValues.setup;
        this._applySettings = commandLineValues.applySettings;
    }

    private makePathAbsolute(p: string): string{

        if(path.isAbsolute(p)){
            return p;
        }

        return path.join(process.cwd(), p);
    }

    private _settingsValid: boolean;

    public get allSettingsDefined(): boolean {
        return this._settingsValid;
    }

    private _nvidiaSmiPath: string;
    private _nvidiaSmiParams?: string[];

    public get nividiaSmiLaunchParams(): IApplicationLaunchParams {
        return {
            path: this._nvidiaSmiPath,
            params: this._nvidiaSmiParams
        }
    }

    private _nvidiaSettingsPath: string;
    private _nvidiaSettingsParams?: string[];

    public get nividiaSettingsLaunchParams(): IApplicationLaunchParams {
        return {
            path: this._nvidiaSettingsPath,
            params: this._nvidiaSettingsParams
        }
    }

    private _nvidiaXconfigPath: string;
    private _nvidiaXconfigParams?: string[];

    public get nividiaXConfigLaunchParams(): IApplicationLaunchParams {
        return {
            path: this._nvidiaXconfigPath,
            params: this._nvidiaXconfigParams
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

    private _initialClock: number | undefined;

    public get initialClock(): number | undefined {
        return this._initialClock;
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
        return this._logFolder;
    }

    private _query: boolean;

    public get query(): boolean {
        return this._query;
    }

    private _maxFans: boolean;

    public get maxFans(): boolean {
        return this._maxFans;
    }

    private _resetFans: boolean;

    public get resetFans(): boolean {
        return this._resetFans;
    }

    private _applySettings: boolean;

    public get applySettings(): boolean {
        return this._applySettings;
    }

    private _setup: boolean;

    public get setup(): boolean {
        return this._setup;
    }

    private _identify?: number;

    public get identify(): number | undefined {
        return this._identify;
    }
}