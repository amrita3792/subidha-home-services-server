const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
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

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

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
  const messageCollection = client.db("SubidhaHomeService").collection("chats");
  const providersCollection = client
    .db("SubidhaHomeService")
    .collection("providers");
  const bookingCollection = client
    .db("SubidhaHomeService")
    .collection("booking");
  const reviewsCollection = client
    .db("SubidhaHomeService")
    .collection("reviews");

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
          serviceCategory: serviceCategory.serviceName,
          subCategory,
          serviceOverview: serviceCategory.serviceOverview,
          faq: serviceCategory.faq,
        });
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/service-categories", async (req, res) => {
      let serviceName = req.query.serviceName;

      // Encoding the serviceName parameter
      serviceName = serviceName.replace(/&/g, "%26");

      if (serviceName) {
        const category = await allServicesCollection.findOne({
          serviceName: {
            $regex: serviceName,
          },
        });
        return res.send(category);
      }
      return res.send({});
    });

    app.get("/users", async (req, res) => {
      try {
        const searchTerm = req.query.searchText;
        const page = req.query.page;
        const size = req.query.size;
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

    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const query = {
          uid: user.uid,
        };
        const result = await usersCollection.findOneAndUpdate(
          query,
          {
            $set: user,
          },
          { upsert: true, new: true }
        );
        if (result === null || result) {
          res.send({ acknowledged: true });
        }
      } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.get("/users/:uid", async (req, res) => {
      try {
        const uid = req.params.uid;
        const query = {
          uid,
        };
        const user = await usersCollection.findOne(query);
        res.send(user);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.post("/users/:uid", async (req, res) => {
      try {
        const data = req.body;
        const uid = req.params.uid;

        const filter = {
          uid,
        };

        const options = { upsert: true };

        const updateDoc = {
          $set: {
            [Object.keys(data)[0]]: Object.values(data)[0],
          },
        };
        const result = await usersCollection.updateOne(
          filter,
          updateDoc,
          options
        );
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.put("/update-status/:uid", async (req, res) => {
      try {
        const uid = req.params.uid;
        const status = req.body.status;
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
        const result = await usersCollection.updateOne(
          filter,
          updateDoc,
          options
        );
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.put("/user/update-image/:uid", async (req, res) => {
      const userId = req.params.uid;
      const { photoURL } = req.body.photoURL;

      try {
        const updateResult = await usersCollection.updateOne(
          { uid: userId },
          { $set: { photoURL } }
        );
        res.json(updateResult);
      } catch (err) {
        console.error("Error updating image:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.patch("/users/admin/:uid", verifyJWT, async (req, res) => {
      const decodedUID = req.decoded.uid;
      console.log(decodedUID);
      console.log(req.query.userId);
      const uid = req.params.uid;
      if (req.query.userId !== decodedUID) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const { role } = req.body;
      try {
        const filter = {
          uid,
        };
        // const options = { upsert: true };
        const updateDoc = {
          $set: {
            role,
          },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (err) {
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/users/admin/:uid", async (req, res) => {
      const uid = req.params.uid;
      const query = {
        uid: uid,
      };
      const user = await usersCollection.findOne(query);
      console.log(user);
      res.send({
        isAdmin:
          user?.role === "Admin" ||
          user?.role === "Sub admin" ||
          user?.role === "Super admin",
      });
    });

    app.post("/providers", async (req, res) => {
      try {
        const provider = req.body;
        const result = await providersCollection.insertOne(provider);
        res.send(result);
      } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.get("/providers", async (req, res) => {
      const { division, district, upazila, serviceCategory } = req.query;

      try {
        const query = {};
        if (division) query.division = division;
        if (district) query.district = district;
        if (upazila) query.upazila = upazila;
        if (serviceCategory) query.serviceCategory = serviceCategory;

        console.log(division);

        const serviceProviders = await providersCollection
          .find(query)
          .toArray();
        res.json(serviceProviders);
      } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/providers/:uid", async (req, res) => {
      const uid = req.params.uid;
      try {
        const providerDetails = await providersCollection.findOne({ uid });
        res.send(providerDetails);
      } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/users/provider/:uid", async (req, res) => {
      const uid = req.params.uid;
      const query = {
        uid: uid,
      };
      const user = await providersCollection.findOne(query);
      console.log({ isProvider: user?.role === "provider" });
      res.send({ isProvider: user?.role === "provider" });
    });

    app.post("/booking", async (req, res) => {
      const newBooking = req.body;
      try {
        const result = await bookingCollection.insertOne(newBooking);
        res.send(result);
      } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/booking/:uid", async (req, res) => {
      const userUID = req.params.uid;

      try {
        const query = {
          userUID,
        };
        const bookingList = await bookingCollection.find(query).toArray();
        res.send(bookingList);
      } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/provider-bookings/:providerId", async (req, res) => {
      const serviceManUID = req.params.providerId;

      try {
        const query = {
          serviceManUID,
        };
        const bookingList = await bookingCollection.find(query).toArray();
        res.send(bookingList);
      } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/booking-details/:id", async (req, res) => {
      const bookingID = req.params.id;
      try {
        const query = {
          _id: new ObjectId(bookingID),
        };
        const bookingDetails = await bookingCollection.findOne(query);
        res.send(bookingDetails);
      } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.patch("/booking-status/:bookingId", async (req, res) => {
      const { status } = req.body;

      console.log(status);
      const bookingId = req.params.bookingId;
      console.log(bookingId);
      try {
        const filter = {
          _id: new ObjectId(bookingId),
        };
        console.log(filter);
        const updateDoc = {
          $set: {
            bookingStatus: status,
          },
        };
        console.log(filter);
        const result = await bookingCollection.updateOne(filter, updateDoc);
        console.log(result);
        res.send(result);
      } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/provider-details/:uid", async (req, res) => {
      const providerID = req.params.uid;
      try {
        const query = {
          uid: providerID,
        };
        const provider = await providersCollection.findOne(query);
        res.send(provider);
      } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.post("/review", async (req, res) => {
      const review = req.body;
      try {
        const result = await reviewsCollection.insertOne(review);
        res.send(result);
      } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/reviews/:providerId", async (req, res) => {
      const serviceManUID = req.params.providerId;
      try {
        const query = { serviceManUID };
        const reviews = await reviewsCollection
          .find(query)
          .sort({ _id: -1 })
          .toArray();
        res.send(reviews);
      } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/find-services", async (req, res) => {
      const searchText = req.query.searchText;
      if (searchText) {
        const allServiceCategories = await allServicesCollection
          .find({})
          .toArray();
        const matchedServices = [];
        allServiceCategories.map((serviceCategory) => {
          const services = serviceCategory.subCategories;
          services.map((service) => {
            if (
              service.serviceName
                .toLowerCase()
                .includes(searchText.toLowerCase())
            ) {
              matchedServices.push({
                categoryId: serviceCategory._id,
                subCategoryId: service.id,
                serviceName: service.serviceName,
              });
            }
          });
        });
        return res.send(matchedServices);
      }
      res.send([]);
    });

    app.get("/user-bookings-reviews/:uid", async (req, res) => {
      const userUID = req.params.uid;

      const bookings = await bookingCollection
        .find({
          userUID,
        })
        .toArray();
      const reviews = await reviewsCollection
        .find({
          userUID,
        })
        .toArray();
      res.send({
        totalBookings: bookings.length,
        totalReviews: reviews.length,
      });
    });

    app.get("/user-reviews/:uid", async (req, res) => {
      const userUID = req.params.uid;
      try {
        const query = {
          userUID,
        };
        const reviews = await reviewsCollection.find(query).toArray();
        res.send(reviews);
      } catch (error) {}
    });

    app.post("/edit-provider-service/:providerId", async (req, res) => {
      const providerId = req.params.providerId;
      const { editService } = req.body;

      try {
        const provider = await providersCollection.findOne({ uid: providerId });

        if (provider) {
          if (provider.myServices && provider.myServices.length > 0) {
            // Update existing service
            const matchedService = provider.myServices.find((service) => {
              if (service.serviceName === editService.serviceName) {
                return service;
              }
            });
            if (matchedService) {
              matchedService.amount = editService.amount;
              matchedService.details = editService.details;
              if (
                matchedService.selectedFileURL !== editService.selectedFileURL
              ) {
                matchedService.selectedFileURL = editService.selectedFileURL;
              }
              const restServices = provider.myServices.filter((service) => {
                if (service.serviceName !== editService.serviceName) {
                  return service;
                }
              });

              const result = await providersCollection.findOneAndUpdate(
                { uid: providerId },
                { $set: { myServices: [...restServices, matchedService] } },
                { returnOriginal: false }
              );

              return res.send(result);
            } else {
              const restServices = provider.myServices.filter((service) => {
                if (service.serviceName !== editService.serviceName) {
                  return service;
                }
              });
              const result = await providersCollection.findOneAndUpdate(
                { uid: providerId },
                { $set: { myServices: [...restServices, editService] } },
                { returnOriginal: false }
              );
              return res.send(result);
            }
          }
          // res.json(result.value);
          else {
            // Create new service array
            const result = await providersCollection.findOneAndUpdate(
              { uid: providerId },
              { $set: { myServices: [editService] } },
              { returnOriginal: false }
            );
            return res.json(result);
          }
        } else {
          res.status(404).json({ error: "Provider not found" });
        }
      } catch (error) {
        console.error("Error updating provider service:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.post("/provider-service/:providerId", async(req, res) => {
      const providerId = req.params.providerId;
      const {serviceName} = req.body;
      console.log(serviceName)

      const provider = await providersCollection.findOne({uid: providerId});
      if(provider?.myServices) {
        const matchedService = provider.myServices.find(service => service.serviceName === serviceName);
        return res.send(matchedService);
      } 
      res.json.send({});
    })

    app.get("/jwt", async (req, res) => {
      const uid = req.query.uid;
      const query = { uid };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ uid }, process.env.ACCESS_TOKEN, {
          expiresIn: "1h",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
    });

    app.get("/chats/:roomId", async (req, res) => {
      const roomId = req.params.roomId;
      const query = {
        roomId,
      };
      const result = await messageCollection.findOne(query);
      if (result) {
        res.send(result);
      } else {
        res.send({ messages: [] });
      }
    });

    app.get("/messages/:uid", async (req, res) => {
      try {
        const uid = req.params.uid;
        const query = {
          $or: [{ senderId: uid }, { receiverId: uid }],
        };
        const conversations = await messageCollection.find(query).toArray();

        const previousMessagesData = await Promise.all(
          conversations.map(async (conversation) => {
            const conversationIDs = conversation.roomId.split("-");
            const receiverId =
              conversationIDs[0] === uid
                ? conversationIDs[1]
                : conversationIDs[0];
            const user = await usersCollection.findOne({ uid: receiverId });
            const lastMessage =
              conversation.messages[conversation.messages.length - 1];

            let formattedLastMessage;
            if (lastMessage.senderId === uid) {
              formattedLastMessage = `You: ${lastMessage.message}`;
            } else {
              formattedLastMessage = lastMessage.message;
            }

            return {
              uid: user.uid,
              userName: user.userName,
              photoURL: user.photoURL,
              lastMessage: formattedLastMessage,
            };
          })
        );

        res.send(previousMessagesData);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    io.on("connection", (socket) => {
      socket.on("joinRoom", (sessionId) => {
        socket.join(sessionId);
      });

      const roomParticipants = {};
      socket.on("joinRoom", async ({ uid1, uid2 }) => {
        // Ensure that the room ID is unique for the conversation
        let roomId;

        const result = await messageCollection.findOne({
          $or: [
            { roomId: [uid1, uid2].sort().join("-") },
            { roomId: [uid2, uid1].sort().join("-") },
          ],
        });

        if (result) {
          roomId = result.roomId;
        } else {
          roomId = [uid1, uid2].sort().join("-");
        }
        // Check if the room already has two participants
        const participants = roomParticipants[roomId] || [];
        if (participants.length < 2) {
          socket.join(roomId);

          // Add the participant to the list
          roomParticipants[roomId] = participants.concat(socket.id);

          // Notify the client about successful room join
          socket.emit("roomJoined", { success: true, roomId });
        } else {
          // Notify the client that the room is full
          socket.emit("roomJoined", {
            success: false,
            message: "Room is full",
          });
        }
      });

      socket.on("typing", ({ roomId, senderId, receiverId }) => {
        io.to(roomId).emit(`typing-${receiverId}`, { senderId });
      });

      socket.on("notTyping", ({ roomId, senderId, receiverId }) => {
        io.to(roomId).emit(`notTyping-${receiverId}`, { senderId });
      });

      socket.on(
        "privateMessage",
        async ({ roomId, senderId, receiverId, message }) => {
          try {
            const conversation = await messageCollection.findOneAndUpdate(
              {
                roomId: roomId,
              },
              {
                $push: {
                  messages: { senderId, message },
                },
                $set: {
                  senderId,
                  receiverId,
                  seenStatus: {
                    [senderId]: true,
                    [receiverId]: false,
                  },
                },
              },
              { upsert: true, new: true }
            );
            io.to(roomId).emit(`privateMessage-${receiverId}`, {
              senderId,
              message,
            });
            io.to(roomId).emit(`myMessage-${senderId}`, { senderId, message });
            return conversation;
          } catch (error) {
            console.error("Error saving message:", error);
            throw error;
          }
        }
      );
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
