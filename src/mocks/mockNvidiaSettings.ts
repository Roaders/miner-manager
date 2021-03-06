

function mockNvidiaSettings() {

    function query(params: string){
        let output: string;

        if(params.indexOf("GPUGraphicsClockOffset") >= 0){
            output = "0";
        } else if(params.indexOf("GPUMemoryTransferRateOffset") >= 0){
            output = ((Math.floor(Math.random() * 5) + 7) * 100).toString();
        } else {
            output = "no query found";
        }

        console.log(output);
    }

    function assign(params: string){
        console.log(`Assigning: ${params}`);
    }

    const args = process.argv.slice(2);

    for(let argIndex = 0; argIndex < args.length; argIndex++){
        const arg = args[argIndex];

        switch(arg){
            case "-q":
                return query(args[++argIndex]);
        }
        switch(arg){
            case "-a":
                return assign(args[++argIndex]);
        }
    }
}

setTimeout(mockNvidiaSettings, Math.random() * 1000 );