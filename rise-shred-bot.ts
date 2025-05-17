import {createSyncPublicClient, syncTransport} from 'rise-shred-client';
import {parseEther, parseGwei, defineChain, createWalletClient, http, encodeFunctionData} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {Pool} from 'pg';
import 'dotenv/config';

// Create PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.PONDER_DATABASE_URL,
});

let currentNonce: number | null = null;


// Create performance schema if it doesn't exist
async function setupPerformanceSchema() {
    await pool.query(`
    CREATE SCHEMA IF NOT EXISTS performance_metrics;
    
    CREATE TABLE IF NOT EXISTS performance_metrics.order_timings (
      id SERIAL PRIMARY KEY,
      transaction_hash TEXT,
      start_timestamp TIMESTAMP WITH TIME ZONE,
      client_setup_timestamp TIMESTAMP WITH TIME ZONE,
      signing_start_timestamp TIMESTAMP WITH TIME ZONE,
      signing_end_timestamp TIMESTAMP WITH TIME ZONE,
      transaction_submit_timestamp TIMESTAMP WITH TIME ZONE,
      transaction_sent_timestamp TIMESTAMP WITH TIME ZONE,
      end_timestamp TIMESTAMP WITH TIME ZONE,
      total_duration_ms NUMERIC,
      block_number BIGINT,
      gas_used BIGINT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
}

async function saveTimingMetrics(timingData) {
    const query = `
        INSERT INTO performance_metrics.order_timings (transaction_hash, start_timestamp, client_setup_timestamp,
                                                       signing_start_timestamp, signing_end_timestamp,
                                                       transaction_submit_timestamp, transaction_sent_timestamp,
                                                       end_timestamp, total_duration_ms, block_number, gas_used)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
    `;

    const values = [
        timingData.transactionHash,
        timingData.startTimestamp,
        timingData.clientSetupTimestamp,
        timingData.signingStartTimestamp,
        timingData.signingEndTimestamp,
        timingData.transactionSubmitTimestamp,
        timingData.transactionSentTimestamp,
        timingData.endTimestamp,
        timingData.totalDuration,
        timingData.blockNumber,
        timingData.gasUsed
    ];

    const result = await pool.query(query, values);
    return result.rows[0].id;
}

async function main() {
    // Start overall timing
    const startTime = performance.now();
    const startTimestamp = new Date();
    console.log(`[TIMING] Starting order placement process at ${startTimestamp.toISOString()}`);

    // Get credentials from environment or use placeholders
    const privateKey = process.env.PRIVATE_KEY || '0x';
    const rpcUrl = process.env.PONDER_RPC_URL || 'https://indexing.staging.riselabs.xyz/';
    const routerAddress = process.env.PROXY_ROUTER_ADDRESS || '0x830B83BAb367A9f3aDa7F23Ea03a36F8aB3970e2';

    const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const account = privateKeyToAccount(formattedKey as `0x${string}`);

    // Create custom transport with sync transaction support
    const transport = syncTransport(rpcUrl);

    // Create sync public client
    const publicClient = createSyncPublicClient({
        transport,
    });

    // Get chain ID
    const chainId = await publicClient.getChainId();
    console.log('Connected to network with chainId:', chainId);

    // Define chain with the detected chain ID
    const chain = defineChain({
        id: chainId,
        name: 'Dynamic Chain',
        nativeCurrency: {
            decimals: 18,
            name: 'Ether',
            symbol: 'ETH',
        },
        rpcUrls: {
            default: {http: [rpcUrl]},
        },
    });

    // Create wallet client
    const walletClient = createWalletClient({
        account,
        transport: http(rpcUrl),
    });

    // Record client setup completion time
    const clientSetupTimestamp = new Date();
    console.log(`[TIMING] Client setup completed at ${clientSetupTimestamp.toISOString()}`);

    // Always fetch the latest nonce from the network


    // Update the global nonce if null or if network nonce is higher
    if (currentNonce === null) {
        const networkNonce = await publicClient.getTransactionCount({
            address: account.address,
        });

        console.log(`Updating nonce from ${currentNonce} to ${networkNonce}`);
        currentNonce = networkNonce;
    }

    console.log(`Using nonce: ${currentNonce}`);

    // Define ABI for placeOrderWithDeposit function
    const placeOrderAbi = [
        {
            type: "function",
            name: "placeOrderWithDeposit",
            inputs: [
                {
                    name: "pool",
                    type: "tuple",
                    internalType: "struct IPoolManager.Pool",
                    components: [
                        {
                            name: "baseCurrency",
                            type: "address",
                            internalType: "Currency",
                        },
                        {
                            name: "quoteCurrency",
                            type: "address",
                            internalType: "Currency",
                        },
                        {
                            name: "orderBook",
                            type: "address",
                            internalType: "contract IOrderBook",
                        },
                    ],
                },
                {
                    name: "_price",
                    type: "uint128",
                    internalType: "uint128",
                },
                {
                    name: "_quantity",
                    type: "uint128",
                    internalType: "uint128",
                },
                {
                    name: "_side",
                    type: "uint8",
                    internalType: "enum IOrderBook.Side",
                },
                {
                    name: "_user",
                    type: "address",
                    internalType: "address",
                },
            ],
            outputs: [
                {
                    name: "orderId",
                    type: "uint48",
                    internalType: "uint48",
                },
            ],
            stateMutability: "nonpayable",
        }
    ];

    // Define order parameters
    const baseCurrency = '0x8e17654Cdb72E247D39EBD10664599cc47cD27F4';
    const quoteCurrency = '0x4b9A14Ca8b00b6D83c8D663a4D9471A79CA6f58e';
    const orderBook = '0xbCD9b173DCb1374E344C449840b6a317542632F4';
    const price = 15e6; // 15 USDC
    const quantity = 1e17; // 0.1 LINK
    const side = 0;

    // Record transaction signing start
    const signingStartTimestamp = new Date();
    console.log(`[TIMING] Transaction signing started at ${signingStartTimestamp.toISOString()}`);

    // Sign the transaction to call placeOrderWithDeposit
    const signedTransaction = await walletClient.signTransaction({
        to: routerAddress as `0x${string}`,
        value: parseEther('0.0'),
        gas: 700000n,
        nonce: currentNonce++, // Use the tracked nonce
        data: encodeFunctionData({
            abi: placeOrderAbi,
            functionName: 'placeOrderWithDeposit',
            args: [
                [baseCurrency, quoteCurrency, orderBook],
                price,
                quantity,
                side,
                account.address
            ],
        }),
        maxFeePerGas: parseGwei('0.00002'),
        maxPriorityFeePerGas: parseGwei('0.00001'),
        chain,
    });

    // Record transaction signing end
    const signingEndTimestamp = new Date();
    console.log(`[TIMING] Transaction signed at ${signingEndTimestamp.toISOString()}`);

    // Record transaction submission time
    const transactionSubmitTimestamp = new Date();
    console.log(`[TIMING] Sending transaction at ${transactionSubmitTimestamp.toISOString()}`);

    // Send the transaction and get receipt in one call
    const receipt = await publicClient.sendRawTransactionSync(signedTransaction);

    // Record transaction sent time
    const transactionSentTimestamp = new Date();
    console.log(`[TIMING] Transaction confirmed at ${transactionSentTimestamp.toISOString()}`);

    const endTime = performance.now();
    const endTimestamp = new Date();
    const duration = endTime - startTime;

    console.log('Limit order placed successfully!');
    console.log('Transaction hash:', receipt.transactionHash);
    console.log('Block number:', receipt.blockNumber.toString());
    console.log('Gas used:', receipt.gasUsed.toString());

    // Log timing information
    console.log(`[TIMING] Order placement completed at ${endTimestamp.toISOString()}`);
    console.log(`[TIMING] Total order placement duration: ${duration.toFixed(2)} ms`);

    const transaction = await publicClient.waitForTransactionReceipt(
        {hash: receipt.transactionHash,}
    );

    console.log('Transaction details:', transaction);

    // Prepare timing metrics for database
    const timingData = {
        transactionHash: receipt.transactionHash,
        startTimestamp,
        clientSetupTimestamp,
        signingStartTimestamp,
        signingEndTimestamp,
        transactionSubmitTimestamp,
        transactionSentTimestamp,
        endTimestamp,
        totalDuration: parseFloat(duration.toFixed(2)),
        blockNumber: BigInt(receipt.blockNumber),
        gasUsed: BigInt(receipt.gasUsed)
    };

    // Store timing metrics in PostgreSQL
    try {
        console.log('Setting up performance schema...');
        await setupPerformanceSchema();

        console.log('Saving timing metrics to database...');
        const recordId = await saveTimingMetrics(timingData);
        console.log(`Timing metrics saved with ID: ${recordId}`);
    } catch (error) {
        console.error('Error saving timing metrics to database:', error);
    }
}

// main().catch(console.error);


async function infiniteOrderLoop() {
    while (true) {
        try {
            await main();
        } catch (error) {
            console.error('Error in order loop:', error);
        }
        // Optional: wait 1 second between orders
        // await new Promise(r => setTimeout(r, 1000));
    }
}

infiniteOrderLoop();