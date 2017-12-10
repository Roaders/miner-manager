import { Observable, Subject } from "rxjs";
import { Socket } from "net";

export interface IClaymoreStats {
    version: string,
    runningTimeMs: number,
    ethHashes?: IHashStats,
    altHashStats?: IHashStats,
    pool: string
}

export interface IHashStats{
    rate: number;
    shares: number;
    rejected: number;
    invalid: number;
    poolSwitches: number;
}

export class ClaymoreService {

    constructor(private _port: number, private _host: string = "127.0.0.1") {
    }

    public getMinerStats(): Observable<IClaymoreStats> {
        const client = new Socket();
        const subject = new Subject<string>();

        const request = { "id": 0, "jsonrpc": "2.0", "method": "miner_getstat1" };

        client.connect(this._port, this._host, () => {
            client.write(JSON.stringify(request));
        });

        client.on('data', data => {
            subject.next(data.toString());
            subject.complete();
            client.destroy();
        });

        return subject
            .map(d => JSON.parse(d))
            .map<any, string[]>(r => r.result)
            .map<string[], IClaymoreStats>(([version, runningTime, hashes,,altHashes,,, pool, invalidShares]) => this.createStats(version,runningTime,hashes,altHashes,pool,invalidShares));
    }

    private createStats(version: string, 
        runningTime: string, 
        hashSharesRejects: string, 
        altHashSharesRejects: string, 
        pool: string,
        invalidSharesComposite: string): IClaymoreStats {

            const [invalidShares,poolSwitches,invalidAltShares,altPoolSwitches] = invalidSharesComposite.split(";");

            return {
                version,
                pool,
                runningTimeMs: parseInt(runningTime) * 60 * 1000, // convert to ms
                ethHashes: this.createHashStats(hashSharesRejects, invalidShares, poolSwitches),
                altHashStats: this.createHashStats(altHashSharesRejects, invalidAltShares, altPoolSwitches)
            };
    }

    private createHashStats(hashDetails: string, invalid: string, switches: string): IHashStats | undefined{
        const [hashString,sharesString,rejectsString] = hashDetails.split(";");

        if(hashString === "0"){
            return undefined;
        }

        return {
            invalid: parseInt(invalid),
            rate: parseInt(hashString),
            shares: parseInt(sharesString),
            rejected: parseInt(rejectsString),
            poolSwitches: parseInt(switches)
        }
    }
}