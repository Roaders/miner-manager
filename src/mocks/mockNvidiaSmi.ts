
interface ICommandArgument {
    name: string;
    value?: string[]
}

function mockNvidiaSmi() {
    function formatArgument(input: string): ICommandArgument {
        if (input.indexOf("=") < 0) {
            return { name: input };
        }

        const [name, valueString] = input.split("=");
        const value = valueString.split(",");
        return { name, value };
    }

    function queryGpu(args: ICommandArgument[]) {
        const query: ICommandArgument | undefined = args.filter(c => c.name === "--query-gpu")[0];
        const format: ICommandArgument = args.filter(c => c.name === "--format")[0];

        const requestedParams = query.value ? query.value : [];

        for (let index = 0; index < 12; index++) {
            let output = "";

            requestedParams.forEach(value => {
                if (output != "") output += ", ";
                switch (value) {
                    case "index":
                        output += index;
                        break;
                    case "uuid": 
                        output += `uuid_${index}`;
                        break;
                    case "pci.bus_id":
                        output += `00000000:${index.toString(16)}:00.0`;
                        break;
                    case "power.draw":
                        const power = (Math.random() * 30) + 80;
                        output += `${power.toFixed(2).toString()} W`;
                        break;
                    case "power.limit":
                        output += `100.00 W`;
                        break;
                    case "power.min_limit":
                        output += `105.00 W`
                        break;
                    case "utilization.gpu":
                    case "fan.speed":
                        const utilization = (Math.random() * 30) + 70;
                        output += `${utilization.toFixed().toString()} %`;
                        break;
                    case "temperature.gpu":
                        const temperature = Math.floor((Math.random() * 30) + 50);
                        output += temperature.toString();
                        break;
                }
            })

            console.log(output);
        }
    }

    let confirmation = "";

    const args = process.argv.slice(2)
        .map(formatArgument);

    for (let index: number = 0; index < args.length; index++) {
        const arg = args[index];

        switch (arg.name) {
            case "--query-gpu":
                return queryGpu(args);

            case "-pl":
            case "-pm":
            case "-i":
                confirmation += confirmation === "" ? confirmation : ", ";
                confirmation += `${arg.name}: ${args[++index].name}`
                break;
        }
    };

    console.log(`nvidia-smi update: ${confirmation}`);
}

setTimeout(mockNvidiaSmi, Math.random() * 1000 );