// Import required modules
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const winston = require("winston");
const https = require("https");
const fs = require("fs");
const { validationResult, check } = require("express-validator");

// Define the logger configuration
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

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
    const cars = await Car.find({});
    res.render("index", { cars, user: req.session.user });
  } catch (err) {
    logger.error("Error fetching cars:", err);
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
app.post(
  "/add",
  [
    check("manufacturer").notEmpty(),
    check("price").isNumeric(),
    check("model").notEmpty(),
    check("year").isNumeric(),
    check("color").notEmpty(),
    check("engineType").notEmpty(),
    check("vin").isNumeric(),
    check("mileage").isNumeric(),
    check("fuelType").notEmpty(),
    check("transmissionType").notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

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
  }
);

// Route to render the car detail page
app.get("/cardetails/:id", async (req, res) => {
  try {
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
    const car = await Car.findById(req.params.id);
    res.render("updatecar", { car, user: req.session.user });
  } catch (err) {
    logger.error("Error:", err);
    res.status(500).send("Error fetching car details for update");
  }
});

// Route to handle form submission and update the car details in the database
app.post(
  "/update/:id",
  [
    check("manufacturer").notEmpty(),
    check("price").isNumeric(),
    check("model").notEmpty(),
    check("year").isNumeric(),
    check("color").notEmpty(),
    check("engineType").notEmpty(),
    check("vin").isNumeric(),
    check("mileage").isNumeric(),
    check("fuelType").notEmpty(),
    check("transmissionType").notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = req.session.user;
    if (user.role === "admin" || user.role === "salesperson") {
      try {
        await Car.findByIdAndUpdate(req.params.id, req.body);
        res.redirect(`/cardetails/${req.params.id}`);
      } catch (err) {
        logger.error("Error:", err);
        res.status(500).send("Error updating car details");
      }
    } else {
      res.status(403).send("Unauthorized!");
    }
  }
);

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
app.post(
  "/register",
  [
    check("firstName").notEmpty(),
    check("lastName").notEmpty(),
    check("email").isEmail(),
    check("password").isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { firstName, lastName, email, password, role } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).send("Email already exists.");
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = new User({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role,
      });

      await newUser.save();

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "levi72300@gmail.com",
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
  }
);

// Route to render the login form
app.get("/login", (req, res) => {
  res.render("login", { user: req.session.user });
});

// Route to handle user login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).send("Invalid email or password");
      return;
    }
    req.session.user = user;
    logger.info(`User ${req.body.email} logged in`);
    res.redirect("/");
  } catch (err) {
    logger.error("Error:", err);
    res.status(500).send("Error logging in");
  }
});

// Route to handle user logout
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error("Error:", err);
      res.status(500).send("Error logging out");
    } else {
      res.redirect("/login");
    }
  });
});

// Route to mark a car as pending sale
app.post("/markPendingSale/:id", async (req, res) => {
  const user = req.session.user;
  if (user.role === "admin" || user.role === "salesperson") {
    try {
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

// Route to render the form for searching cars
app.get("/search", (req, res) => {
  res.render("searchResults", { cars: [], user: req.session.user });
});

// Route to handle search functionality
app.post("/search", async (req, res) => {
  try {
    const { make, model, minYear, maxYear, minPrice, maxPrice } = req.body;

    const query = {};
    if (make) query.manufacturer = make;
    if (model) query.model = model;
    if (minYear && maxYear)
      query.year = { $gte: parseInt(minYear), $lte: parseInt(maxYear) };
    if (minPrice && maxPrice)
      query.price = { $gte: parseInt(minPrice), $lte: parseInt(maxPrice) };

    const cars = await Car.find(query);
    res.render("searchResults", { cars, user: req.session.user });
  } catch (err) {
    logger.error("Error:", err);
    res.status(500).send("Error searching cars");
  }
});

const httpsOptions = {
  key: fs.readFileSync("./certificates/private.key"),
  cert: fs.readFileSync("./certificates/certificate.crt"),
};

const PORT = process.env.PORT || 3000;
https.createServer(httpsOptions, app).listen(PORT, () => {
  console.log(`Server is running on https://localhost:${PORT}`);
});
