const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;


//middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
    const cartCollection = database.collection("cart");
    const shopCollection = database.collection("shop");

    //jwt related api ===============================
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h'
      })
      res.send({ token })
    })

        //middlewares
        const verifyToken = (req, res, next) => {
          // console.log('inside verifyToken', req.headers);
          if (!req.headers.authorization) {
            return res.status(401).send({ message: 'unauthorized Access.' });
          }
          const token = req.headers.authorization.split(' ')[1];
          jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
              return res.status(403).send({ message: 'Invalid Token.' });
            }
            req.decoded = decoded;
            next();
          })
        }

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


    // cart collection =============================
    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.json(result);
    });

    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })

    //users related api ===============================
    app.get("/users", async (req, res) => {
      // const user = req.body;
      const result = await userCollection.find().toArray();
      res.send(result);
    })
    // app.get("/users", async (req, res) => {
    //   const user = req.body;
    //   const result = await userCollection.findOne(user).toArray();
    //   res.send(result);
    // })

    // app.get('/users/admin/:email', async (req, res) => {
    //   const email = req.params.email;
    //   if (email !== req.decoded.email) {
    //     return res.status(403).send({ message: 'unauthorized access' });
    //   }

    //   const query = { email: email };
    //   const user = await userCollection.findOne(query);
    //   let admin = false;
    //   if (user) {
    //     admin = user?.role === 'admin'
    //   }
    //   res.send({ admin });
    // })

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

    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin',
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    app.delete('/users/:id', verifyAdmin, verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
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

app.listen(port, () => {
  console.log(`QuickFix Motors Server listening on port ${port}`);
})