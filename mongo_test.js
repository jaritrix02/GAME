const { MongoClient } = require('mongodb');
const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db("myapp");
    const users = db.collection("users");
    const allUsers = await users.find().toArray();
    console.log(allUsers);
  } finally {
    await client.close();
  }
}
run();