
import { Observable } from "rxjs/Observable";
import { spawn, SpawnOptions } from "child_process";
import { launchChild, childEvent, IChildDataEvent } from "../utils/rx-child-process";
import { MinerSettings, IApplicationLaunchParams } from "../utils/miner-settings";
import { Maybe } from "maybe-monad";
import formatDuration = require("format-duration");

export type SettingsAttribute = "GPUGraphicsClockOffset" | "GPUMemoryTransferRateOffset" | "GPUFanControlState" | "GPUTargetFanSpeed" | "GPUPowerMizerMode";

export type Device = "gpu" | "fan";

export interface INvidiaQuery {
    index: number;
    uuid: string;
    power_draw?: number;
    power_limit?: number;
    power_min_limit?: number;
    utilization_gpu?: number;
    temperature_gpu?: number;
    fan_speed?: number;
    pci_bus_id?: string;
}

export class NvidiaService {

    constructor(private _settings: MinerSettings) {
    }

    public queryAttributeValue(cardIndex: number, attribute: SettingsAttribute, device: Device = "gpu"): Observable<number> {
        const args = Maybe.nullToMaybe(this._settings.nividiaSettingsLaunchParams.params)
            .map(params => params.concat())
            .orElse([])
            .do(params => params.push("-t", "-q", `[${device}:${cardIndex}]/${attribute}`))
            .value;

        let startTime: number;

        return Observable.defer(() => {
                console.log(`Querying ${attribute} for card ${cardIndex}`);
                startTime = Date.now();
                return launchChild(() => spawn(this._settings.nividiaSettingsLaunchParams.path, args, this.spawnOptions))
            })
            .filter(event => event.event === "data")
            .map<childEvent, IChildDataEvent>(event => event as IChildDataEvent)
            .map(event => parseFloat(event.data))
            .do(() => console.log(`Query of ${attribute} for card ${cardIndex} complete in ${formatDuration(Date.now() - startTime)}`));
    }

    public assignAttributeValue(cardIndex: number, attribute: SettingsAttribute, device: Device = "gpu", value: string): Observable<string[]> {
        let attributeString: string;

        switch (attribute) {
            case "GPUMemoryTransferRateOffset":
                attributeString = `${attribute}[3]`;
                break;

            default:
                attributeString = attribute;
        }

        const args = Maybe.nullToMaybe(this._settings.nividiaSettingsLaunchParams.params)
            .map(params => params.concat())
            .orElse([])
            .do(params => params.push("-a", `[${device}:${cardIndex}]/${attributeString}=${value}`))
            .value;

        let startTime: number;

        return Observable.defer(() => {
            console.log(`GPU ${cardIndex}: Setting attribute: ${args}`);
            startTime = Date.now();

            return launchChild(() => spawn(this._settings.nividiaSettingsLaunchParams.path, args, this.spawnOptions))
        })
            .filter(event => event.event === "data")
            .map<childEvent, IChildDataEvent>(event => event as IChildDataEvent)
            .map(event => event.data)
            .do(data => console.log(`Assignment result for ${attribute}:${cardIndex}: ${data} complete in ${formatDuration(Date.now() - startTime)}`))
            .toArray();
    }

    public setFanSpeed(cardIndex: number, value?: number) {

        let startTime: number;

        return Observable.defer(() => {
            let fanSpeed: Observable<string[]>
            startTime = Date.now();
            if (value !== undefined) {
                console.log(`Setting fan speed for ${cardIndex} to ${value}`);
                fanSpeed = this.assignAttributeValue(cardIndex, "GPUTargetFanSpeed", "fan", value.toString());
            } else {
                console.log(`Resetting fan speed for ${cardIndex}`);
                fanSpeed = Observable.of([]);
            }

            const state = value == null ? "0" : "1";
            return this.assignAttributeValue(cardIndex, "GPUFanControlState", "gpu", state)
                .flatMap(() => fanSpeed)
                .do(() => console.log(`Setting fan speed for ${cardIndex} complete in ${formatDuration(Date.now() - startTime)}.`));
        });
    }

    public setPowerLimit(card: INvidiaQuery, requestedLimit: number) {

        const limit = Maybe.nullToMaybe(card.power_min_limit)
            .orElse(100)
            .map(minLimit => Math.max(requestedLimit, minLimit))
            .defaultTo(100);

        return Observable.defer(() => {
            console.log(`Setting power limit for card ${card.index} to ${limit}`);

            return this.assignAttributeValue(card.index, "GPUPowerMizerMode", "gpu", "1")
                .toArray()
                .flatMap(() => this.changeSmiSetting(["-i", card.index.toString(), "-pm", "1"]))
                .toArray()
                .flatMap(() => this.changeSmiSetting(["-i", card.index.toString(), "-pl", limit.toString()]))
                .do(() => console.log(`Setting power limit for ${card.index} complete.`));
        })
    }

    public query(queryParams?: (keyof INvidiaQuery)[]): Observable<INvidiaQuery[]> {

        const query = Maybe.nullToMaybe(queryParams)
            .orElse([])
            .map(params => { params.unshift("pci_bus_id"); return params; })
            .map(params => { params.unshift("uuid"); return params; })
            .map(params => { params.unshift("index"); return params; })
            .defaultTo<(keyof INvidiaQuery)[]>([]);

        let startTime: number;

        const processParams: string[] = Maybe.nullToMaybe(this._settings.nividiaSmiLaunchParams.params)
            .orElse([])
            .map(params => params.concat("--format=csv,noheader", `--query-gpu=${query.map(this.mapParameter).join()}`))
            .defaultTo([]);

        return Observable.defer(() => {
            console.log(`Nvidia-smi query:`);
            startTime = Date.now();

            return launchChild(() => spawn(this._settings.nividiaSmiLaunchParams.path, processParams))
        })
            .filter(message => message.event === "data")
            .map<childEvent, IChildDataEvent>(m => <any>m)
            .map(message => this.parseQueryResult(message, query))
            .filter(result => result != null)
            .map<INvidiaQuery | undefined, INvidiaQuery>(result => result!)
            .toArray()
            .do(() => console.log(`Query Complete in ${formatDuration(Date.now() - startTime)}`));
    }

    public setupMonitors() {
        const params: string[] = Maybe.nullToMaybe(this._settings.nividiaXConfigLaunchParams.params)
            .map(p => p.concat())
            .orElse([])
            .do(params => params.push("-a", "--allow-empty-initial-configuration", "--cool-bits=31", "--use-display-device=DFP-0", "--connected-monitor=DFP-0"))
            .defaultTo([]);

        return launchChild(() => spawn(this._settings.nividiaXConfigLaunchParams.path, params))
            .filter(message => message.event === "data")
            .map<childEvent, IChildDataEvent>(m => <any>m)
            .map(message => message.data)
            .filter(result => result != null)
            .do(data => console.log(data))
            .toArray();
    }

    private changeSmiSetting(smiArguments: string[]) {
        const params: string[] = Maybe.nullToMaybe(this._settings.nividiaSmiLaunchParams.params)
            .map(p => p.concat())
            .orElse([])
            .do(params => params.push(...smiArguments))
            .defaultTo([]);

        let startTime: number;

        return Observable.defer(() => {
            console.log(`Adjusting smi setting: ${smiArguments}`);
            startTime = Date.now();

            return launchChild(() => spawn(this._settings.nividiaSmiLaunchParams.path, params))
                .filter(message => message.event === "data")
                .map<childEvent, IChildDataEvent>(m => <any>m)
                .map(message => message.data)
                .filter(result => result != null)
                .do(data => console.log(`Smi setting result: ${data}`))
                .toArray()
                .do(() => console.log(`Smi setting adjustment ${smiArguments} complete in ${formatDuration(Date.now() - startTime)}`));
        })
    }

    private mapParameter(parameter: keyof INvidiaQuery): string {
        let output = parameter.replace("_", ".");

        switch (output) {
            case "power.min.limit":
                output = "power.min_limit";
                break;

            case "pci_bus_id":
                output = "pci.bus_id";
                break;
        }

        return output;
    }

    private parseQueryResult(input: IChildDataEvent, queryParams: (keyof INvidiaQuery)[]): INvidiaQuery | undefined {

        console.log(input.data);

        const values = input.data.split(", ");

        if (values.length !== queryParams.length) {
            console.warn(`different number of results (${input}) and params (${queryParams}) from nvidi-smi, not returning a result`);
        }

        const [index, uuid] = values;

        const result: INvidiaQuery = { index: parseInt(index), uuid };

        for (var i = 0; i < queryParams.length; i++) {
            let value: any;
            switch (queryParams[i]) {
                case "index":
                case "temperature_gpu":
                    value = parseInt(values[i]);
                    break;
                case "utilization_gpu":
                case "fan_speed":
                    value = this.parsePercentage(values[i]);
                    break;
                case "power_draw":
                case "power_limit":
                case "power_min_limit":
                    value = this.parsePower(values[i]);
                    break;
                default:
                    value = values[i];
            }

            result[queryParams[i]] = value;
        }

        return result;
    }

    private parsePercentage(input: string): number {
        const regularExpression = /(\d+) *\%/

        return Maybe.nullToMaybe(input)
            .map(input => regularExpression.exec(input))
            .map(result => result[1])
            .map(subString => parseInt(subString))
            .defaultTo(NaN);
    }

    private parsePower(input: string): number {
        const regularExpression = /([\d\.]+) *W/

        return Maybe.nullToMaybe(input)
            .map(input => regularExpression.exec(input))
            .map(result => result[1])
            .map(subString => parseFloat(subString))
            .defaultTo(NaN);
    }

    private get spawnOptions(): SpawnOptions {
        return {
            env: {
                DISPLAY: ":0",
                XAUTHORITY: "/var/run/lightdm/root/:0"
            }
        }
    }
}
