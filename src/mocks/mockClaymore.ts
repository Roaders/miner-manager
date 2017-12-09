
import { Observable } from "rxjs";
import * as http from "http";
import { timeout } from "rxjs/operator/timeout";
import { setTimeout } from "timers";

import * as net from "net";

let port: number | undefined;
let workerName: string | undefined;

const portRegExp = /-mport +(\d+)/;
const workerNameRegExp = /-eworker +(\w+)/;

process.argv.forEach(arg => {
    const portResult = portRegExp.exec(arg);
    if (portResult) {
        port = parseInt(portResult[1]);
    }
    const workerNameResult = workerNameRegExp.exec(arg);
    if (workerNameResult) {
        workerName = workerNameResult[1];
    }
})

port = port ? port : 3333;

const startTime = Math.random() * 2500;

setTimeout(() => {
    console.log(`Remote management is enabled on ${port}`);

    const server = net.createServer(socket => {

        socket.on("error", (err) => {
            console.log(`caught error`);
        });

        socket.on("data", (data: Buffer) => {
            socket.write(`{"result": ["9.3 - ETH", "21", "182724;51;0", "30502;30457;30297;30481;30479;30505", "0;0;0", "off;off;off;off;off;off", "53;71;57;67;61;72;55;70;59;71;61;70", "eth-eu1.nanopool.org:9999", "0;0;0;0"]}`);
        });

    });

    server.listen(port, () => console.log(`server listening`));

}, startTime)

//console.log(`args: ${process.argv}`)

// http.createServer((request, response) => {
//     response.writeHead(200, {'Content-Type': 'text/plain'}); 
//     response.end(`Hello World port ${port}\n`);
// }).listen(port);

const dieTime = (Math.random() * 20000) + 3000;

//console.log(`dieTime: ${dieTime}`);

setTimeout(() => process.exit(), dieTime);