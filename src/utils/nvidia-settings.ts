
import { Observable } from "rxjs/Observable";
import { spawn, SpawnOptions } from "child_process";
import { launchChild, childEvent, IChildDataEvent } from "../utils/rx-child-process";
import { MinerSettings, IApplicationLaunchParams } from "../utils/miner-settings";
import { Maybe } from "maybe-monad";

export type SettingsAttribute = "GPUGraphicsClockOffset" | "GPUMemoryTransferRateOffset" | "GPUFanControlState" | "GPUTargetFanSpeed";

export type Device = "gpu" | "fan";

export class NvidiaSettings{

    constructor(private _settings: MinerSettings) {
    }

    public querySettings(cardIndex: number, attribute: SettingsAttribute, device: Device = "gpu" ): Observable<number> {
        const args = Maybe.nullToMaybe(this._settings.nividiSettingsLaunchParams.params)
            .map(params => params.concat())
            .orElse([])
            .do(params => params.push("-t", "-q", `[${device}:${cardIndex}]/${attribute}`))
            .value;
    
        return Observable.defer(() => launchChild(() => spawn(this._settings.nividiSettingsLaunchParams.path, args, this.spawnOptions)))
            .filter(event => event.event === "data")
            .map<childEvent, IChildDataEvent>(event => event as IChildDataEvent)
            .map(event => parseFloat(event.data));
    }

    public assignValue(cardIndex: number, attribute: SettingsAttribute, device: Device = "gpu", value: string): Observable<string[]>{
        const args = Maybe.nullToMaybe(this._settings.nividiSettingsLaunchParams.params)
            .map(params => params.concat())
            .orElse([])
            .do(params => params.push("-a", `[${device}:${cardIndex}]/${attribute}=${value}`))
            .value;
    
        return Observable.defer(() => launchChild(() => spawn(this._settings.nividiSettingsLaunchParams.path, args, this.spawnOptions)))
            .filter(event => event.event === "data")
            .map<childEvent, IChildDataEvent>(event => event as IChildDataEvent)
            .map(event => event.data)
            .do(data => console.log(`Assignment result: ${data}`))
            .toArray();
    }

    private get spawnOptions(): SpawnOptions{
        return {
            env: {
                DISPLAY: ":0",
                XAUTHORITY: "/var/run/lightdm/root/:0"
            }
        }
    }
}