
import { Observable } from "rxjs";
import * as http from "http";
import { timeout } from "rxjs/operator/timeout";

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

console.log(`args: ${process.argv}`)
console.log(`launching server ${workerName}: ${port}`);

// http.createServer((request, response) => {
//     response.writeHead(200, {'Content-Type': 'text/plain'}); 
//     response.end(`Hello World port ${port}\n`);
// }).listen(port);

const dieTime = (Math.random() * 20000) + 1500;

console.log(`dieTime: ${dieTime}`);

setTimeout(() => process.exit(), dieTime);