
import {launchChild} from "./rx-child-process";
import {Observable} from "rxjs";
import {spawn} from "child_process";

export interface INvidiaQuery{
    index?: number;
    uuid?: string;
}

export function makeQuery(queryParams: (keyof INvidiaQuery)[]): Observable<INvidiaQuery>{
    if(queryParams.length === 0){
        return Observable.empty();
    }
    const existingParams: string[] = ["dist/mocks/mockNvidiaSmi.js"];
    const processParams: string[] = existingParams.concat("--format=csv,noheader", `--query-gpu=${queryParams.join()}`);

    return launchChild(() => spawn('node', processParams))
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