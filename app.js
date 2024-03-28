// Import required modules
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");

// Initialize express app
const app = express();

// Set up EJS as the view engine
app.set("view engine", "ejs");

// Middleware for parsing JSON data
app.use(bodyParser.json());

// Middleware for parsing URL-encoded data
app.use(bodyParser.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/autoMobileInventory", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

// Create a Mongoose schema for cars
const carSchema = new mongoose.Schema({
  manufacturer: String,
  price: Number,
  model: String,
  year: Number,
  images: [String],
  color: String,
  engineType: String,
  vin: Number,
  mileage: Number,
  fuelType: String,
  transmissionType: String,
});

// Create a Mongoose model based on the schema
const Car = mongoose.model("Car", carSchema);

// Route to fetch and display cars
app.get("/", async (req, res) => {
  try {
    // Fetch all cars from the database
    const cars = await Car.find({});
    res.render("index", { cars });
  } catch (err) {
    console.error("Error fetching cars:", err);
    res.status(500).send("Error fetching cars");
  }
});

// Route to render the form for adding a new car
app.get("/add", (req, res) => {
  res.render("add");
});

// Route to handle form submission and save the new car to the database
app.post("/add", async (req, res) => {
  // Extract car details from the request body
  const {
    manufacturer,
    price,
    model,
    year,
    color,
    images,
    engineType,
    vin,
    mileage,
    fuelType,
    transmissionType,
  } = req.body;

  // Create a new car object
  const newCar = new Car({
    manufacturer,
    price,
    model,
    year,
    color,
    images,
    engineType,
    vin,
    mileage,
    fuelType,
    transmissionType,
  });
  newCar
    .save()
    .then(() => {
      res.redirect("/");
    })
    .catch((err) => {
      console.log("Error:", err);
      res.status(500).send("Error adding new car");
    });
});

// Route to render the car detail page
app.get("/cardetails/:id", async (req, res) => {
  try {
    // Find the car by ID
    const car = await Car.findById(req.params.id);
    if (!car) {
      res.status(404).send("Car not found");
      return;
    }
    res.render("carDetails", { car });
  } catch (err) {
    console.error("Error fetching car details:", err);
    res.status(500).send("Error fetching car details");
  }
});

// Route to render the form for updating a car
app.get("/update/:id", async (req, res) => {
  try {
    // Fetch the car details based on the provided ID
    const car = await Car.findById(req.params.id);
    res.render("updatecar", { car });
  } catch (err) {
    console.error("Error fetching car details for update:", err);
    res.status(500).send("Error fetching car details for update");
  }
});

// Route to handle form submission and update the car details in the database
app.post("/update/:id", async (req, res) => {
  try {
    // Find the car by ID and update its details
    await Car.findByIdAndUpdate(req.params.id, req.body);
    res.redirect(`/cardetails/${req.params.id}`);
  } catch (err) {
    console.error("Error updating car details:", err);
    res.status(500).send("Error updating car details");
  }
});

// Delete route
app.post("/deleteCar/:id", (req, res) => {
  Car.findByIdAndDelete(req.params.id)
    .then(() => {
      res.status(200).send("Car deleted successfully");
      res.redirect("/");
    })
    .catch((err) => {
      console.log("err", err);
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
