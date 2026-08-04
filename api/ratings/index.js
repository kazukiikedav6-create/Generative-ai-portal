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

        // --- POST: 評価（1〜5）と改善要望メッセージを保存 ---
        if (req.method === "POST") {
            const { agentId, rating, comment } = req.body || {};
            
            if (!agentId || !rating || rating < 1 || rating > 5) {
                return {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: "Invalid agentId or rating (must be 1-5)" })
                };
            }

            const ratingDoc = {
                id: "rating-" + Date.now().toString() + "-" + Math.random().toString(36).substring(2, 7),
                type: "rating",
                agentId: agentId,
                rating: Number(rating),
                comment: comment || "", // 改善要望コメントを保存
                timestamp: new Date().toISOString()
            };

            await container.items.create(ratingDoc);

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: "Rating and feedback saved successfully" })
            };
        }
    } catch (error) {
        context.log.error('Rating API Error:', error);
        return {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};
