
import {Observable} from "rxjs";

type settings = "nvidia-smi-path" | "miner-path";

export interface IApplicationLaunchParams{
    path: string;
    params?: string[];
}

export class MinerSettings{
    
    public get nividiSmiLaunchParams(): Observable<IApplicationLaunchParams>{
        const params = {
            path: "node",
            params: [ "dist/mocks/mockNvidiaSmi.js" ]
        }

        return Observable.of(params);
    }
}