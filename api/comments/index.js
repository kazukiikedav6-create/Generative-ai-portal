const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context, req) {
    const connectionString = process.env.COSMOS_DB_CONNECTION_STRING;
    
    if (!connectionString) {
        return { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: "Missing COSMOS_DB_CONNECTION_STRING" }) 
        };
    }

    try {
        const client = new CosmosClient(connectionString);
        const container = client.database("PortalLogDB").container("UsageLogs");

        // コメントが存在するログ（最新100件）を日時降順で取得
        const querySpec = {
            query: "SELECT c.id, c.agentId, c.rating, c.comment, c.timestamp FROM c WHERE IS_DEFINED(c.comment) AND c.comment != '' ORDER BY c.timestamp DESC OFFSET 0 LIMIT 100"
        };
        const { resources } = await container.items.query(querySpec).fetchAll();

        return {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resources)
        };
    } catch (error) {
        context.log.error('Comments API Error:', error);
        return {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};
