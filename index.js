const express = require('express'); 
const cors = require('cors');
require ('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;


//middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dedsmmq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("quickFix");

    const userCollection = client.db("bistroDb").collection("users");
    const reviewCollection = database.collection("reviews");
    const shopCollection = database.collection("shop");

    //users related api ===============================
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);

      //insert email if user does not exist
      if (existingUser) {
        return res.send({ message: "User already exists with this email", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    //shop related api ===============================
    app.get('/shop', async (req, res) => {
        const result = await shopCollection.find().toArray();
        res.json(result);
    })
    app.get('/reviews', async (req, res) => {
        const result = await reviewCollection.find().toArray();
        res.json(result);
    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("Hello from QuickFix Motors Server");
});

app.listen(port, () =>{
    console.log(`QuickFix Motors Server listening on port ${port}`);
})