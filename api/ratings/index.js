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

        // --- GET: 全エージェントの平均評価を集計して取得 ---
        if (req.method === "GET") {
            const querySpec = {
                query: "SELECT c.agentId, c.rating FROM c WHERE c.type = 'rating'"
            };
            const { resources } = await container.items.query(querySpec).fetchAll();

            const stats = {};
            resources.forEach(item => {
                if (!item.agentId || !item.rating) return;
                if (!stats[item.agentId]) {
                    stats[item.agentId] = { total: 0, count: 0 };
                }
                stats[item.agentId].total += Number(item.rating);
                stats[item.agentId].count += 1;
            });

            const result = {};
            Object.keys(stats).forEach(agentId => {
                const count = stats[agentId].count;
                const avg = count > 0 ? (stats[agentId].total / count).toFixed(1) : 0;
                result[agentId] = { average: Number(avg), count: count };
            });

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result)
            };
        }

        // --- POST: 評価（1〜5）または改善要望コメントを保存 ---
        if (req.method === "POST") {
            const { agentId, rating, comment } = req.body || {};
            
            if (!agentId) {
                return {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: "agentId is required" })
                };
            }

            if (!rating && !comment) {
                return {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: "Either rating or comment is required" })
                };
            }

            const isRating = rating && Number(rating) >= 1 && Number(rating) <= 5;
            const docType = isRating ? "rating" : "comment";

            const doc = {
                id: docType + "-" + Date.now().toString() + "-" + Math.random().toString(36).substring(2, 7),
                type: docType,
                agentId: agentId,
                rating: isRating ? Number(rating) : undefined,
                comment: comment || "",
                timestamp: new Date().toISOString()
            };

            await container.items.create(doc);

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: "Saved successfully" })
            };
        }
    } catch (error) {
        context.log.error('Rating/Feedback API Error:', error);
        return {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};
