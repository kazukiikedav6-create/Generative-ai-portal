const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context, req) {
    const connectionString = process.env.COSMOS_DB_CONNECTION_STRING;
    
    if (!connectionString) {
        return { status: 500, body: "Missing COSMOS_DB_CONNECTION_STRING" };
    }

    try {
        const client = new CosmosClient(connectionString);
        const database = client.database("PortalLogDB");
        const container = database.container("UsageLogs");

        const logData = req.body || {};
        logData.id = Date.now().toString() + "-" + Math.random().toString(36).substring(2, 7);

        await container.items.create(logData);

        return {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "Success" })
        };
    } catch (error) {
        context.log.error('Cosmos DB Error:', error);
        return {
            status: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
