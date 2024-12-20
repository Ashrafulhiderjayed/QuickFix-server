const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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

    const userCollection = database.collection("usersInfo");
    const serviceCollection = database.collection('services');
    const bookingCollection = database.collection('bookings');
    const reviewCollection = database.collection("reviews");
    const cartCollection = database.collection("cart");
    const shopCollection = database.collection("shop");
    const paymentCollection = database.collection("payments");

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

    //use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }

    //users related api ===============================
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      // console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    app.get('/users/admin/:email', verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'unauthorized access' });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin'
      }
      res.send({ admin });
    })

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

    //shop related api ===============================
    app.get('/shop', async (req, res) => {
      const result = await shopCollection.find().toArray();
      res.json(result);
    })

    app.get('/shop/:id', async (req, res) => {
      const id = req.params.id;

      // Check if the provided ID is a valid ObjectId
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: 'Invalid ID format' });
      }

      try {
        // Try to find the document by ObjectId
        let query = { _id: new ObjectId(id) };
        let result = await shopCollection.findOne(query);

        // If not found, try to find by string ID
        if (!result) {
          query = { _id: id };
          result = await shopCollection.findOne(query);
        }

        if (!result) {
          return res.status(404).send({ message: 'Menu item not found' });
        }

        res.send(result);
      } catch (error) {
        console.error('Error fetching menu item:', error);
        res.status(500).send({ error: 'An error occurred while fetching the menu item' });
      }
    });

    app.post('/shop', verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await shopCollection.insertOne(item);
      res.send(result);
    });

    app.patch('/shop/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
      }

      const result = await shopCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    app.delete('/shop/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await shopCollection.deleteOne(query);
      res.send(result);
    })

    //reviews collection =============================
    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.json(result);
    })

    // payment intent related api =============================

    app.get('/payments/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email }
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })


    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      // console.log(amount, 'amount inside the intent')

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      // carefully delete each item from the cart
      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id))
        }
      }

      const deleteResult = await cartCollection.deleteMany(query);
      res.send({ paymentResult, deleteResult });
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

    //services api =================================================================
    app.get('/services', async(req, res) =>{
      const cursor = serviceCollection.find();
      const result = await cursor.toArray();
      res.send(result);
      // console.log(result)
    })

    app.get('/service/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const options = {
        projection: {title: 1, top: 1, description: 1, detailDescription: 1, img: 1},
      };
      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    });

    // appointment =================================================================
    app.get('/appointments', async(req, res) => {
      const result = await bookingCollection.find().toArray();
      res.send(result);
    });

    app.get('/appointments/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email }
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/appointments', verifyToken, async(req, res) =>{
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.delete('/appointments/:id', verifyToken, verifyAdmin, async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    })

    // Stats or Analytics  =================================================================
    app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const shopItems = await shopCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      const payments = await paymentCollection.find().toArray();

      // const revenue = payments.reduce((total, payment) => total + payment.price, 0);
      const result = await paymentCollection.aggregate([{
        $group: {
          _id: null,
          totalRevenue: { $sum: '$price' }
        }
      }]).toArray();

      const revenue = result.length > 0 ? result[0].totalRevenue : 0;
      res.send({
        users,
        shopItems,
        orders,
        revenue,
      });
    })

    //order status using aggregation pipeline
     app.get('/order-stats',  async (req, res) => {
      const result = await paymentCollection.aggregate([
        {
          $unwind: '$menuItemIds'
        },
        {
          $lookup:{
            from: 'shop',
            localField: 'menuItemIds',
            foreignField: '_id',
            as: 'menuItems'
          }
        },
        {
          $unwind: '$menuItems'
        },
        {
          $group: {
            _id: '$menuItems.category',
            quantity: { $sum: 1 },
            revenue: {$sum: '$menuItems.price'}
          }
        },
        {
          $project: {
            _id: 0,
            category: '$_id',
            quantity: '$quantity',
            revenue: '$revenue'
          }
        }
      ]).toArray();
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