import mongoose from "mongoose";
import nodemailer from "nodemailer";

// --------------------
// MongoDB Connection
// --------------------
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.warn("⚠️ MONGODB_URI not set.");
}

mongoose.set("strictQuery", true);

let cachedConnection = null;
async function connectToDatabase() {
  if (cachedConnection) return cachedConnection;

  try {
    cachedConnection = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");
    return cachedConnection;
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    throw new Error("Database connection failed");
  }
}

// --------------------
// Mongoose Schema
// --------------------
const contactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  message: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false },
});

const Contact =
  mongoose.models.Contact || mongoose.model("Contact", contactSchema);

// --------------------
// Nodemailer Transport
// --------------------
async function createTransporter() {
  const { EMAIL_USER, EMAIL_PASS, NODE_ENV } = process.env;

  if (!EMAIL_USER || !EMAIL_PASS) {
    throw new Error("Email credentials are missing");
  }

  if (NODE_ENV === "production") {
    // ✅ Use Gmail App Password in production
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });
  } else {
    // ✅ Safe test mode for development
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }
}

// --------------------
// Serverless Handler
// --------------------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method Not Allowed" });
  }

  const { name, email, message } = req.body;

  // --------------------
  // Basic validation
  // --------------------
  if (!name || name.trim().length < 2) {
    return res
      .status(400)
      .json({ success: false, error: "Name must be at least 2 characters" });
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid email address" });
  }
  if (!message || message.trim().length < 10) {
    return res.status(400).json({
      success: false,
      error: "Message must be at least 10 characters",
    });
  }

  try {
    await connectToDatabase();

    const contactMessage = new Contact({ name, email, message });
    await contactMessage.save();

    const transporter = await createTransporter();

    // --------------------
    // Send admin email
    // --------------------
    await transporter.sendMail({
      from: process.env.EMAIL_USER || "noreply@portfolio.com",
      to: "chalabirmechu@gmail.com",
      subject: `New Contact Form Submission from ${name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
      `,
    });

    // --------------------
    // Auto-reply to sender
    // --------------------
    await transporter.sendMail({
      from: process.env.EMAIL_USER || "noreply@portfolio.com",
      to: email,
      subject: "Thank you for contacting Chala Birmechu",
      html: `
        <h2>Thank you for your message!</h2>
        <p>Hi ${name},</p>
        <p>Thank you for reaching out! I have received your message and will respond as soon as possible.</p>
        <p>Best regards,<br>Chala Birmechu</p>
      `,
    });

    return res
      .status(200)
      .json({ success: true, message: "Message sent successfully!" });
  } catch (error) {
    console.error("❌ Contact form error:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}
