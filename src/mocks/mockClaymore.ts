
import { Observable } from "rxjs";
import * as http from "http";
import { timeout } from "rxjs/operator/timeout";
import { setTimeout } from "timers";

import * as net from "net";

let port: number | undefined;

const portRegExp = /^\d+$/;

//console.log(`args: ${process.argv}`)

for (let argIndex = 0; argIndex < process.argv.length; argIndex++) {
    const currentArg = process.argv[argIndex];

    if (currentArg === "-mport") {
        argIndex++;
        const portArg = process.argv[argIndex];

        if (portRegExp.test(portArg)) {
            port = parseInt(portArg);
        }
    }
}

port = port != undefined ? port : 3333;

const startTime = Math.random() * 2500;

setTimeout(() => {
    console.log(`Remote management is enabled on ${port}`);

    let minerStartTime = Date.now();

    const server = net.createServer(socket => {

        socket.on("error", (err) => {
            console.log(`caught error`);
        });

        socket.on("data", (data: Buffer) => {
            const minutes = Math.floor((Date.now() - minerStartTime) / 1000).toString();

            socket.write(`{"result": ["10.0 - ETH", "${minutes}", "31398;591;0", "31398", "0;0;0", "off", "68;66", "eu1.ethermine.org:4444", "0;0;0;0"]}`);
        });

    });

    server.listen(port, () => console.log(`server listening`));

}, startTime)

const dieTime = (Math.random() * 20000) + 3000;

//console.log(`dieTime: ${dieTime}`);

setTimeout(() => process.exit(), dieTime);