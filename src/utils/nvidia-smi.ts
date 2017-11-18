
import {IApplicationLaunchParams} from "./miner-settings";
import {launchChild} from "./rx-child-process";
import {Observable} from "rxjs";
import {spawn} from "child_process";
import {Maybe} from "maybe-monad";

export interface INvidiaQuery{
    index?: number;
    uuid?: string;
}

export function makeQuery(smiParams: IApplicationLaunchParams, queryParams: (keyof INvidiaQuery)[]): Observable<INvidiaQuery>{
    if(queryParams.length === 0){
        return Observable.empty();
    }

    const processParams: string[] = Maybe.nullToMaybe(smiParams.params)
        .orElse([])
        .map(params => params.concat("--format=csv,noheader", `--query-gpu=${queryParams.join()}`))
        .defaultTo([]);

    return launchChild(() => spawn(smiParams.path, processParams))
        .map(line => parseQueryResult(line, queryParams))
        .filter(result => result != null)
        .map<INvidiaQuery | undefined,INvidiaQuery>(result => result!);
}

function parseQueryResult(input: string, queryParams: (keyof INvidiaQuery)[]): INvidiaQuery | undefined{
    const result: INvidiaQuery = {};

    const values = input.split(", ");

    if(values.length !== queryParams.length){
        console.warn(`different number of results (${input}) and params (${queryParams}) from nvidi-smi, not returning a result`);
    }

    for(var index = 0; index < queryParams.length; index++){
        let value: any;
        switch(queryParams[index]){
            case "index":
                value = parseInt(values[index]);
                break;
            default:
                value = values[index];
        }

        result[queryParams[index]] = value;
    }

    return result;
}