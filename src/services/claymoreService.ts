import { Observable, Subject } from "rxjs";
import { Socket } from "net";

export interface IClaymoreStats {
    version: string,
    runningTime: number,
    hashrate: number,
    shares: number,
    rejectedShared: number,
    pool: string
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
            .map<string[], IClaymoreStats>(([version, runningTime, hashSharesRejects,,,,, pool]) => this.createStats(version,runningTime,hashSharesRejects,pool));
    }

    private createStats(version: string, 
        runningTime: string, 
        hashSharesRejects: string, 
        pool: string): IClaymoreStats {

            const [hashString,sharesString,rejectsString] = hashSharesRejects.split(";");

            return {
                version,
                pool,
                runningTime: parseInt(runningTime),
                hashrate: parseInt(hashString) / 1000,
                shares: parseInt(sharesString),
                rejectedShared: parseInt(rejectsString)
            };
    }
}