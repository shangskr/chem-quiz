const { MongoClient } = require('mongodb');

let client = null;
async function getDb() {
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const pp = req.method === 'GET' || req.method === 'DELETE'
    ? req.query.passphrase : req.body?.passphrase;
  if (!pp) return res.status(400).json({ error: 'passphrase required' });

  const id = hash(pp);

  try {
    const col = await getDb();

    if (req.method === 'GET') {
      const doc = await col.findOne({ _id: id });
      return res.json({ data: doc ? doc.data : null });
    }

    if (req.method === 'POST') {
      const body = req.body;
      if (!body || !body.data) return res.status(400).json({ error: 'data required' });
      await col.replaceOne(
        { _id: id },
        { _id: id, passphrase: pp, data: body.data },
        { upsert: true }
      );
      return res.json({ ok: true });
    }

    if (req.method === 'DELETE') {
      await col.deleteOne({ _id: id });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(16);
}
