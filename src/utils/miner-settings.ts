
type settings = "nvidia-smi-path" | "miner-path";

export interface IApplicationLaunchParams{
    path: string;
    params?: string[];
}

export class MinerSettings{
    
    public get nividiSmiLaunchParams(): IApplicationLaunchParams{
        return {
            path: "node",
            params: [ "dist/mocks/mockNvidiaSmi.js" ]
        }
    }
    
    public get claymoreLaunchParams(): IApplicationLaunchParams{
        return {
            path: "node",
            params: [ "dist/mocks/mockClaymore.js" ]
        }
    }

    public get startPort(): number{
        return 3330;
    }
}