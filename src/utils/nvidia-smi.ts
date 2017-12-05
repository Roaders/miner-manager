
import { IApplicationLaunchParams } from "./miner-settings";
import { launchChild, IChildDataEvent, childEvent } from "./rx-child-process";
import { Observable } from "rxjs";
import { spawn } from "child_process";
import { Maybe } from "maybe-monad";

export interface INvidiaQuery {
    index: number;
    uuid: string;
    power_draw?: number;
    power_limit?: number;
    utilization_gpu?: number;
    temperature_gpu?: number;
}

export function makeNvidiaQuery(smiParams: IApplicationLaunchParams, queryParams?: (keyof INvidiaQuery)[]): Observable<INvidiaQuery[]> {

    const query = Maybe.nullToMaybe(queryParams)
        .orElse([])
        .map(params => { params.unshift("index"); return params; })
        .map(params => { params.unshift("uuid"); return params; })
        .defaultTo<(keyof INvidiaQuery)[]>([]);

    const processParams: string[] = Maybe.nullToMaybe(smiParams.params)
        .orElse([])
        .map(params => params.concat("--format=csv,noheader", `--query-gpu=${query.map(param => param.replace("_", ".")).join()}`))
        .defaultTo([]);

    return launchChild(() => spawn(smiParams.path, processParams))
        .filter(message => message.event === "data")
        .map<childEvent, IChildDataEvent>(m => <any>m)
        .map(message => parseQueryResult(message, query))
        .filter(result => result != null)
        .map<INvidiaQuery | undefined, INvidiaQuery>(result => result!)
        .toArray();
}

function parseQueryResult(input: IChildDataEvent, queryParams: (keyof INvidiaQuery)[]): INvidiaQuery | undefined {
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
                value = parseUtilization(values[i]);
                break;
            case "power_draw":
            case "power_limit":
                value = parsePower(values[i]);
                break;
            default:
                value = values[i];
        }

        result[queryParams[i]] = value;
    }

    return result;
}

function parseUtilization(input: string): number {
    const regularExpression = /(\d+) *\%/

    return Maybe.nullToMaybe(input)
        .map(input => regularExpression.exec(input))
        .map(result => result[1])
        .map(subString => parseInt(subString))
        .defaultTo(NaN);
}

function parsePower(input: string): number {
    const regularExpression = /([\d\.]+) *W/

    return Maybe.nullToMaybe(input)
        .map(input => regularExpression.exec(input))
        .map(result => result[1])
        .map(subString => parseFloat(subString))
        .defaultTo(NaN);
}