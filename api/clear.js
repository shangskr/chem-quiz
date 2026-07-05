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
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const key = req.headers['x-admin-key'] || req.query.key;
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const col = await getCol();
    const result = await col.deleteMany({});
    return res.json({ deleted: result.deletedCount });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
