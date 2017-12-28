

function mockNvidiaXConfig() {

    const args = process.argv.slice(2);

    console.log(`Nvidia XConfig: ${args.join(", ")}`);
}

setTimeout(mockNvidiaXConfig, Math.random() * 1000 );