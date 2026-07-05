const { MongoClient } = require('mongodb');

let client = null;
async function getCol() {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
  }
  return client.db('chem_quiz').collection('progress');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = req.headers['x-admin-key'] || req.query.key;
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const col = await getCol();

    if (req.method === 'GET') {
      const docs = await col.find({}).toArray();
      const list = docs.map(function(d) {
        var saves = (d.data && d.data.saves) || [];
        return {
          id: d._id,
          passphrase: d.passphrase,
          saves: saves.length,
          lastSave: saves.length ? saves.reduce(function(a,b){return a.timestamp>b.timestamp?a:b}).timestamp : null,
          flagged: (d.data && d.data.flaggedQids && d.data.flaggedQids.length) || 0,
          stats: d.data&&d.data.stats||{}
        };
      });
      list.sort(function(a,b){return (b.lastSave||0)-(a.lastSave||0)});
      return res.json({ users: list });
    }

    if (req.method === 'DELETE') {
      var targetId = req.query.id;
      if (!targetId) return res.status(400).json({ error: 'id required' });
      var result = await col.deleteOne({ _id: targetId });
      return res.json({ deleted: result.deletedCount });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
