// Import required modules
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const session = require("express-session"); // Express session for session management
const cookieParser = require("cookie-parser"); // Cookie parser for parsing cookies
const helmet = require("helmet"); // Helmet for HTTP header security
const winston = require("winston");

// Define the logger configuration
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }), // Log errors to error.log file
    new winston.transports.File({ filename: "combined.log" }), // Log all other levels to combined.log file
  ],
});

// log to the console as well
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

// Initialize express app
const app = express();

// Set up EJS as the view engine
app.set("view engine", "ejs");

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/autoMobileInventory", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => logger.info("Connected to MongoDB"))
  .catch((err) => logger.error("Error connecting to MongoDB:", err));

// Middleware for parsing JSON data
app.use(bodyParser.json());

// Middleware for parsing URL-encoded data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Initialize cookie parser middleware
app.use(cookieParser());

// Initialize session middleware
app.use(
  session({
    secret: "bingo",
    resave: true,
    saveUninitialized: true,
    cookie: {
      secure: false,
      maxAge: 3600000,
      httpOnly: true,
    },
  })
);

// Use helmet middleware for setting HTTP headers for security
app.use(helmet());

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
  status: {
    type: String,
    enum: ["available", "pending sale", "sold"],
    default: "available",
  },
});

// Create a Mongoose model based on the schema
const Car = mongoose.model("Car", carSchema);

// Create a Mongoose schema for users
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  password: String,
  role: String,
});

// Create a Mongoose model based on the schema
const User = mongoose.model("User", userSchema);

// Route to fetch and display cars
app.get("/", async (req, res) => {
  try {
    // Fetch all cars from the database
    const cars = await Car.find({});
    res.render("index", { cars, user: req.session.user });
  } catch (err) {
    console.error("Error fetching cars:", err);
    res.status(500).send("Error fetching cars");
  }
});

// Route to render the form for adding a new car
app.get("/add", (req, res) => {
  const user = req.session.user;

  if (user && user.role === "admin") {
    res.render("add", { user: req.session.user });
  } else {
    res.status(403).send("Unauthorized!");
  }
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
      logger.info("New car added");
      res.redirect("/");
    })
    .catch((err) => {
      logger.error("Error:", err);
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
    res.render("carDetails", { car, user: req.session.user });
  } catch (err) {
    logger.error("Error:", err);
    res.status(500).send("Error fetching car details");
  }
});

// Route to render the form for updating a car
app.get("/update/:id", async (req, res) => {
  try {
    // Fetch the car details based on the provided ID
    const car = await Car.findById(req.params.id);
    res.render("updatecar", { car, user: req.session.user });
  } catch (err) {
    logger.error("Error:", err);
    res.status(500).send("Error fetching car details for update");
  }
});

// Route to handle form submission and update the car details in the database
app.post("/update/:id", async (req, res) => {
  const user = req.session.user;
  if (user.role === "admin" || user.role === "salesperson") {
    try {
      // Find the car by ID and update its details
      await Car.findByIdAndUpdate(req.params.id, req.body);
      res.redirect(`/cardetails/${req.params.id}`);
    } catch (err) {
      logger.error("Error:", err);
      res.status(500).send("Error updating car details");
    }
  } else {
    res.status(403).send("Unauthorized!");
  }
});

// Delete route
app.post("/deleteCar/:id", (req, res) => {
  const user = req.session.user;
  if (user.role === "admin") {
    Car.findByIdAndDelete(req.params.id)
      .then(() => {
        res.status(200).send("Car deleted successfully");
        res.redirect("/");
      })
      .catch((err) => {
        console.log("err", err);
      });
  } else {
    res.status(403).send("Unauthorized!");
  }
});

// Route to render the registration form
app.get("/register", (req, res) => {
  res.render("register", { user: req.session.user });
});

// Route to handle user registration
app.post("/register", async (req, res) => {
  try {
    // Extract user details from the request body
    const { firstName, lastName, email, password, role } = req.body;
    // Check if  email already exists
    const existingUser = await User.findOne({
      $or: [{ email }],
    });
    if (existingUser) {
      return res.status(400).send("Email already exists.");
    }
    // Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create a new user object
    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role,
    });

    // Save the new user to the database
    await newUser.save();

    // Send registration success email using nodemailer
    // Configuration is for Gmail
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "levi72300@gmail.com",
        // This password needs to be generated from google account
        pass: "itng rryl sdmt pnic",
      },
    });

    await transporter.sendMail({
      from: '"AutomobileInventory" <noreply@example.com>',
      to: email,
      subject: "Registration Successful",
      text: "Welcome to our Automobile Inventory! Your registration was successful.",
    });

    res.send("Registration successful! Check your email for confirmation.");
  } catch (err) {
    logger.error("Error:", err);
    res.status(500).send("Error registering user");
  }
});

// Route to render the login form
app.get("/login", (req, res) => {
  res.render("login", { user: req.session.user });
});

// Route to handle user login
app.post("/login", async (req, res) => {
  try {
    // Extract user credentials from the request body
    const { email, password } = req.body;
    // Find the user with the provided email
    const user = await User.findOne({ email });
    // Check if user exists and verify password
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).send("Invalid email or password");
      return;
    }
    req.session.user = user;
    // Log the user login event
    logger.info(`User ${req.body.email} logged in`);
    // Redirect to index page upon successful login
    res.redirect("/");
  } catch (err) {
    logger.error("Error:", err);
    res.status(500).send("Error logging in");
  }
});

// Route to handle user logout
app.get("/logout", (req, res) => {
  // Destroy the session
  req.session.destroy((err) => {
    if (err) {
      logger.error("Error:", err);
      res.status(500).send("Error logging out");
    } else {
      // Redirect the user to the login page after logout
      res.redirect("/login");
    }
  });
});

// Route to mark a car as pending sale
app.post("/markPendingSale/:id", async (req, res) => {
  const user = req.session.user;
  if (user.role === "admin" || user.role === "salesperson") {
    try {
      // Find the car by ID and update its status to "pending sale"
      await Car.findByIdAndUpdate(req.params.id, { status: "pending sale" });
      res.redirect(`/cardetails/${req.params.id}`);
    } catch (err) {
      logger.error("Error:", err);
      res.status(500).send("Error marking car as pending sale");
    }
  } else {
    res.status(403).send("Unauthorized!");
  }
});

// Route to render the form for adding a new car
app.get("/search", (req, res) => {
  res.render("searchResults", { cars: [], user: req.session.user });
});

// Route to handle search functionality
app.post("/search", async (req, res) => {
  try {
    // Extract search parameters from the request body
    const { make, model, minYear, maxYear, minPrice, maxPrice } = req.body;

    // Construct query object based on search parameters
    const query = {};
    if (make) query.manufacturer = make;
    if (model) query.model = model;
    if (minYear && maxYear)
      query.year = { $gte: parseInt(minYear), $lte: parseInt(maxYear) };
    if (minPrice && maxPrice)
      query.price = { $gte: parseInt(minPrice), $lte: parseInt(maxPrice) };

    // Fetch cars from the database based on the constructed query
    const cars = await Car.find(query);
    res.render("searchResults", { cars, user: req.session.user }); // Pass cars to the template
  } catch (err) {
    logger.error("Error:", err);
    res.status(500).send("Error searching cars");
  }
});
// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
