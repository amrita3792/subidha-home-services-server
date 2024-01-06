const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// middleware
app.use(express.json());
app.use(cors());

const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.5f5xb9l.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  const allServicesCollection = client
    .db("SubidhaHomeService")
    .collection("services");
  const usersCollection = client.db("SubidhaHomeService").collection("users");

  try {
    app.get("/allServiceCategories", async (req, res) => {
      try {
        const query = {};
        const serviceCategories = await allServicesCollection
          .find(query)
          .sort({ _id: 1 })
          .toArray();
        const allServiceCategory = serviceCategories.map((serviceCategory) => ({
          _id: serviceCategory._id,
          serviceName: serviceCategory.serviceName,
          icon: serviceCategory.icon,
          totalService: serviceCategory.subCategories.length,
        }));
        res.send(allServiceCategory);
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/allServiceCategories/:id", async (req, res) => {
      try {
        const serviceId = req.params.id;
        console.log(serviceId);
        const query = {
          _id: new ObjectId(serviceId),
        };
        const service = await allServicesCollection.findOne(query);
        res.send(service);
      } catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/subcategory/:categoryId/:subCategoryId", async (req, res) => {
      try {
        const categoryId = req.params.categoryId;
        const subCategoryId = req.params.subCategoryId;

        console.log(categoryId);
        console.log(subCategoryId);

        const query = {
          _id: new ObjectId(categoryId),
        };
        const serviceCategory = await allServicesCollection.findOne(query);

        if (!serviceCategory) {
          return res.status(404).send("Service category not found");
        }

        const subCategory = serviceCategory.subCategories.find(
          (subCategory) => subCategory.id === subCategoryId
        );

        if (!subCategory) {
          return res.status(404).send("Subcategory not found");
        }

        res.send({
          subCategory,
          serviceOverview: serviceCategory.serviceOverview,
          faq: serviceCategory.faq,
        });
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = {
        uid: user.uid,
      };
      let result = await usersCollection.findOne(query);

      if (result?.uid === user.uid) {
        const filter = { uid: user.uid };
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            lastLogin: user.lastLogin,
            status: user.status,
          },
        };
        result = await usersCollection.updateOne(filter, updateDoc, options);
        console.log(result);
        res.send({ acknowledged: true });
        return;
      }
      result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const searchTerm = req.query.searchText;
      const page = req.query.page;
      const size = req.query.size;
      // console.log(searchTerm)
      try {
        if (searchTerm) {
          let users = await usersCollection.find().toArray();
          users = users?.filter((user) => {
            console.log(user?.userName);
            console.log(searchTerm);

            // console.log(user.phone?.toLowerCase().includes(searchTerm.toLowerCase()) > -1)
            return (
              user.userName?.toLowerCase().search(searchTerm.toLowerCase()) >
                -1 ||
              user.email?.toLowerCase().search(searchTerm.toLowerCase()) > -1 ||
              user.phone?.toLowerCase().search(searchTerm.toLowerCase()) > -1
            );
          });
          const count = users.count;
          res.send({ users, count });
          return;
        }
        const users = await usersCollection
          .find()
          .skip(page * size)
          .limit(parseInt(size))
          .toArray();
        const count = await usersCollection.estimatedDocumentCount();
        res.json({ users, count });
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.put("/update-status/:uid", async (req, res) => {
      const uid = req.params.uid;
      const status = req.body.status;
      console.log(status);
      try {
        // Find the user by username and update the status
        const filter = {
          uid,
        };
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            status,
          },
        };
        result = await usersCollection.updateOne(filter, updateDoc, options);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    io.on('connection', (socket) => {
      // console.log("New user connected");
      // Join a room based on user UID
      socket.on('joinRoom', (uid) => {
        socket.join(uid);
      });
    
      // Handle private messages
      socket.on('privateMessage', async ({ sender, receiver, content }) => {
        console.log(receiver, content)
        // Save the message to MongoDB
        // const message = new Message({ sender, receiver, content, timestamp: new Date() });
        // await message.save();
    
        // Emit the message to the receiver's room
        io.to(receiver).emit('privateMessage', { sender, content });
        // io.to(sender).emit('privateMessage', { sender, content });
      });
    });
    

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Subidha Home Service Server is Running...");
});

server.listen(port, () => {
  console.log(`Home Services Server app Listening on Port: ${port}`);
});
